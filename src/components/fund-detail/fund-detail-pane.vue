<template>
  <div class="fund-detail-pane">
    <header class="dp-topbar" :class="{ 'is-stuck': bodyScrolled }">
      <button class="dp-back" title="返回" @click="goBack">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="dp-topident">
        <span class="dp-topname" :title="fundName">{{ fundName }}</span>
        <span class="dp-topcode font-number">{{ fundCode }}</span>
      </div>
      <span class="dp-topspacer" aria-hidden="true"></span>
    </header>
    <div ref="detailBodyEl" class="detail-body" @scroll.passive="onBodyScroll">
      <section class="dp-hero">
        <div v-if="fundInfo?.fundType" class="dp-ident">
          <span class="dp-ident-type">{{ fundInfo.fundType }}</span>
        </div>
        <div class="dp-keys">
          <div class="dp-key">
            <span class="dp-key-k">今日涨跌幅</span>
            <span :class="['dp-key-v', 'font-number', rateColor]">
              {{ rateSign }}{{ currentGszzl.toFixed(2) }}%
            </span>
            <span class="dp-key-t font-number">
              <span class="dp-t-year">{{ valuationTimeStr.year }}</span>{{ valuationTimeStr.rest }}
            </span>
          </div>
          <div class="dp-key">
            <span class="dp-key-k">实时涨跌幅</span>
            <template v-if="settingsStore.enablePrediction && realtimeGszzl != null && !isHiddenRtSource">
              <span
                :class="['dp-key-v', 'font-number', realtimeGszzl > 0 ? 'text-rise' : realtimeGszzl < 0 ? 'text-fall' : 'text-flat']"
              >
                {{ realtimeGszzl > 0 ? '+' : '' }}{{ realtimeGszzl.toFixed(2) }}%
              </span>
              <span class="dp-key-t font-number">
                <span class="dp-t-year">{{ realtimeTimeStr.year }}</span>{{ realtimeTimeStr.rest }}
              </span>
            </template>
            <template v-else>
              <span class="dp-key-v font-number text-muted">--</span>
              <span class="dp-key-t">未开启</span>
            </template>
          </div>
          <div class="dp-key">
            <span class="dp-key-k">确认方式</span>
            <span class="dp-key-v dp-key-v-text">{{ confirmTypeText }}</span>
            <span class="dp-key-t">{{ delayDays === 2 ? 'T+2 到账' : 'T+1 到账' }}</span>
          </div>
          <div class="dp-key">
            <span class="dp-key-k">数据状态</span>
            <span class="dp-key-v dp-key-v-text" :class="staleAsOf ? 'text-warn' : isEstimated ? 'text-warn' : 'text-ok'">
              {{ staleAsOf ? '待更新' : isEstimated ? '估值中' : '已确认' }}
            </span>
            <span class="dp-key-t">{{ staleAsOf ? `数据截至 ${staleAsOf.slice(5)}` : isEstimated ? (realtimeSource || '盘中估算') : '净值已公布' }}</span>
          </div>
        </div>
        <div class="dp-ranges" role="tablist">
          <button
            v-for="r in RANGES"
            :key="r.key"
            type="button"
            role="tab"
            :aria-selected="chartRange === r.key"
            :class="['dp-range', chartRange === r.key && 'is-on']"
            @click="chartRange = r.key"
          >{{ r.label }}</button>
        </div>
        <div
          ref="scrubContainer"
          class="chart-box"
          @touchstart.capture.passive="scrub.onTouchStart"
          @touchmove.capture="scrub.onTouchMove"
          @touchend.capture="scrub.onTouchEnd"
          @touchcancel.capture="scrub.onTouchEnd"
          @mousedown="onChartMouseDown"
        >
          <div v-if="activeReadout" class="scrub-readout">
            <span class="scrub-label">{{ activeReadout.label }}</span>
            <span class="scrub-nav font-number">{{ activeReadout.nav.toFixed(4) }}</span>
            <span :class="['scrub-change', 'font-number', activeReadout.change.startsWith('+') ? 'text-rise' : activeReadout.change.startsWith('-') ? 'text-fall' : 'text-muted']">{{ activeReadout.change }}</span>
          </div>
          <div v-if="activeMarkNotes.length > 0" class="scrub-trades">
            <span v-for="(note, i) in activeMarkNotes" :key="i" class="scrub-trade">{{ note }}</span>
          </div>
          <div v-if="activeReadout" class="scrub-line" :style="{ left: scrubLineLeft + 'px' }"></div>
          <template v-if="chartMode === 'intraday'">
            <v-chart v-if="intradayChartOption" ref="intradayChartRef" :option="intradayChartOption" autoresize class="chart" />
            <div v-else class="chart-empty"><p class="text-muted">暂无当日走势数据</p></div>
          </template>
          <template v-else>
            <div v-if="chartLoading" class="chart-empty"><span class="animate-breathe">加载图表数据...</span></div>
            <v-chart v-else-if="chartOption" ref="historyChartRef" :option="chartOption" autoresize class="chart" @datazoom="onHistoryDataZoom" />
            <div v-else class="chart-empty"><p class="text-muted">暂无历史数据</p></div>
          </template>
        </div>
      </section>
      <section v-if="holdingAmount > 0" class="dp-stats">
        <div class="dp-stat">
          <span class="dp-stat-label">持仓金额</span>
          <span :class="['dp-stat-val font-number', !p.holding && 'privacy-blur']">¥{{ formatCompactMoney(holdingAmount) }}</span>
          <span class="dp-stat-sub">{{ currentShares.toFixed(2) }} 份</span>
        </div>
        <div class="dp-stat">
          <span class="dp-stat-label">今日收益</span>
          <span :class="['dp-stat-val font-number', toneOf(todayProfit), !p.todayProfit && 'privacy-blur']">{{ formatProfitCompact(todayProfit) }}</span>
          <span :class="['dp-stat-sub', rateColor]">{{ rateSign }}{{ currentGszzl.toFixed(2) }}%</span>
        </div>
        <div class="dp-stat">
          <span class="dp-stat-label">累计收益</span>
          <span :class="['dp-stat-val font-number', toneOf(totalProfit), !p.totalProfit && 'privacy-blur']">{{ formatProfitCompact(totalProfit) }}</span>
          <span class="dp-stat-sub">本金 ¥{{ formatCompactMoney(principal) }}</span>
        </div>
        <div class="dp-stat">
          <span class="dp-stat-label">累计收益率</span>
          <span :class="['dp-stat-val font-number', toneOf(totalReturnRate), !p.totalRate && 'privacy-blur']">
            {{ totalReturnRate > 0 ? '+' : '' }}{{ totalReturnRate.toFixed(2) }}%
          </span>
          <span class="dp-stat-sub">持有收益率</span>
        </div>
      </section>
      <section v-else class="dp-nohold">
        <span class="dp-nohold-text">尚未记录持仓，可从下方「录入持仓」添加</span>
      </section>
      <PendingPlanList :fund-code="fundCode" />
      <nav class="dp-tabs" role="tablist">
        <button
          v-for="(t, i) in TABS"
          :key="t.key"
          type="button"
          role="tab"
          :aria-selected="activeTab === t.key"
          :class="['dp-tab', activeTab === t.key && 'is-on']"
          @click="selectTab(t.key, $event)"
        >
          <span class="dp-tab-no font-number">{{ String(i + 1).padStart(2, '0') }}</span>
          <span class="dp-tab-label">{{ t.label }}</span>
        </button>
      </nav>
      <section class="dp-panel">
        <template v-if="activeTab === 'perf'">
          <div v-if="perfItems.length > 0" class="perf-row">
            <div v-for="item in perfItems" :key="item.title" :class="['perf-item', item.value > 0 ? 'perf-rise' : item.value < 0 ? 'perf-fall' : 'perf-flat']">
              <span class="perf-val font-number">{{ item.value > 0 ? '+' : '' }}{{ item.value.toFixed(2) }}%</span>
              <span class="perf-label">{{ item.title }}</span>
            </div>
          </div>
          <div v-if="detailLoading && perfItems.length === 0" class="dp-empty"><span class="animate-breathe">加载中...</span></div>
          <template v-else-if="fundInfo">
            <div v-if="fundInfo.assetAllocation && fundInfo.assetAllocation.length > 0" class="alloc-section">
              <p class="dp-panel-cap">资产配置</p>
              <div v-for="item in fundInfo.assetAllocation" :key="item.category" class="alloc-item">
                <div class="alloc-bar-row">
                  <span class="alloc-label">{{ item.category }}</span>
                  <span class="alloc-val font-number">{{ item.ratio.toFixed(2) }}%</span>
                </div>
                <div class="alloc-bar-bg"><div class="alloc-bar-fill" :style="{ width: Math.min(item.ratio, 100) + '%' }"></div></div>
              </div>
            </div>
            <p v-if="perfItems.length === 0 && !fundInfo.assetAllocation?.length" class="dp-empty">暂无区间业绩数据</p>
          </template>
          <p v-else-if="perfItems.length === 0" class="dp-empty">暂无区间业绩数据</p>
          <div v-if="navHistory.length > 0" class="dp-navlist">
            <p class="dp-panel-cap">每日净值 · 显示 {{ navVisible.length }} / {{ navHistory.length }} 条</p>
            <div class="navlist-head">
              <span>日期</span>
              <span>净值</span>
              <span>涨跌</span>
            </div>
            <div class="navlist-body">
              <div v-for="item in navVisible" :key="item.d" class="navlist-row">
                <span class="nl-date font-number">{{ item.d }}</span>
                <span class="nl-val font-number">{{ item.v.toFixed(4) }}</span>
                <span v-if="item.rate != null" :class="['nl-rate font-number', rateTone(item.rate)]">
                  {{ item.rate > 0 ? '+' : '' }}{{ item.rate.toFixed(2) }}%
                </span>
                <span v-else class="nl-rate font-number text-flat">--</span>
              </div>
            </div>
            <button v-if="navHasMore" type="button" class="navlist-more" @click="loadMoreNav">
              加载更多 · 剩余 {{ navHistory.length - navVisible.length }} 条
            </button>
          </div>
        </template>
        <template v-else-if="activeTab === 'stocks'">
          <div v-if="holdingsLoading" class="dp-empty"><span class="animate-breathe">加载持仓数据...</span></div>
          <template v-else-if="displayHoldings && displayHoldings.holdings.length > 0">
            <div class="dp-panel-head">
              <span v-if="holdingsSummary" class="dp-panel-cap">{{ holdingsSummary }}</span>
              <div class="dp-seg" :data-on="holdingsMode">
                <button :class="['dp-seg-btn', holdingsMode === 'close' && 'is-on']" @click="holdingsMode = 'close'">昨日收盘</button>
                <button :class="['dp-seg-btn', holdingsMode === 'realtime' && 'is-on']" @click="holdingsMode = 'realtime'">
                  <i class="seg-dot" aria-hidden="true"></i>实时
                </button>
              </div>
            </div>
            <div class="hx-summary">
              <div class="hx-sum-item">
                <span class="hx-sum-k">前十大合计</span>
                <span class="hx-sum-v font-number">{{ holdingsTotalRatio > 0 ? holdingsTotalRatio.toFixed(2) + '%' : '--' }}</span>
              </div>
              <div class="hx-sum-item">
                <span class="hx-sum-k">前十大贡献</span>
                <span :class="['hx-sum-v font-number', holdingsWeightedChange == null ? 'text-muted' : holdingsWeightedChange > 0 ? 'text-rise' : holdingsWeightedChange < 0 ? 'text-fall' : 'text-flat']">
                  {{ holdingsWeightedChange == null ? '--' : (holdingsWeightedChange > 0 ? '+' : '') + holdingsWeightedChange.toFixed(2) + '%' }}<span v-if="holdingsQuotePartial" class="hx-partial" :title="`${holdingsMissingRatio.toFixed(2)}% 持仓行情未就绪，该值偏小`">*</span>
                </span>
              </div>
              <div class="hx-sum-item">
                <span class="hx-sum-k">行情就绪</span>
                <span :class="['hx-sum-v font-number', holdingsQuotePartial && 'text-muted']">{{ holdingsQuoteReady }}/{{ displayHoldings.holdings.length }}</span>
              </div>
            </div>
            <ul class="hx-list">
              <li
                v-for="(stock, idx) in displayHoldings.holdings"
                :key="stock.stockCode"
                :class="['hx-item', expandedStocks.has(stock.stockCode) && 'is-open']"
              >
                <button type="button" class="hx-main" @click="toggleStock(stock.stockCode)">
                  <span class="hx-bar" :style="{ width: ratioBarWidth(stock.ratio) }" aria-hidden="true"></span>
                  <span class="hx-rank font-number">{{ String(idx + 1).padStart(2, '0') }}</span>
                  <span class="hx-ident">
                    <span class="hx-name">{{ stock.stockName || stock.stockCode }}</span>
                    <span class="hx-meta">
                      <span class="hx-code font-number">{{ stock.stockCode }}</span>
                      <span v-if="rowMarketLabel(stock)" class="hx-mkt">{{ rowMarketLabel(stock) }}</span>
                    </span>
                  </span>
                  <span class="hx-ratio">
                    <span class="hx-ratio-v font-number">{{ stock.ratio > 0 ? stock.ratio.toFixed(2) : '--' }}</span>
                    <span v-if="stock.ratio > 0" class="hx-ratio-u">%</span>
                  </span>
                  <span :class="['hx-chg', 'font-number', stockChange(stock) == null ? 'text-muted' : stockChangeClass(stock)]">
                    {{ stockChange(stock) == null ? '--' : (stockChange(stock)! > 0 ? '+' : '') + (stockChange(stock) as number).toFixed(2) + '%' }}
                  </span>
                  <svg class="hx-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <Transition name="collapse">
                  <div v-if="expandedStocks.has(stock.stockCode)" class="hx-detail">
                    <div class="hx-detail-clip">
                      <div class="hx-detail-inner">
                      <template v-if="stockDetails.get(stock.stockCode)">
                        <div class="hx-kpis">
                          <div class="hx-kpi">
                            <em>持仓占比</em>
                            <b class="font-number">{{ stock.ratio > 0 ? stock.ratio.toFixed(2) + '%' : '--' }}</b>
                          </div>
                          <div class="hx-kpi">
                            <em>{{ holdingsMode === 'close' ? '昨日涨跌' : '实时涨跌' }}</em>
                            <b :class="['font-number', stockChange(stock) == null ? 'text-muted' : stockChangeClass(stock)]">
                              {{ stockChange(stock) == null ? '--' : (stockChange(stock)! > 0 ? '+' : '') + (stockChange(stock) as number).toFixed(2) + '%' }}
                            </b>
                          </div>
                          <div class="hx-kpi">
                            <em>估值贡献</em>
                            <b :class="['font-number', stockDetails.get(stock.stockCode)!.contribution == null ? 'text-muted' : stockDetails.get(stock.stockCode)!.contribution! > 0 ? 'text-rise' : stockDetails.get(stock.stockCode)!.contribution! < 0 ? 'text-fall' : 'text-flat']">
                              {{ stockDetails.get(stock.stockCode)!.contribution == null ? '--' : (stockDetails.get(stock.stockCode)!.contribution! > 0 ? '+' : '') + stockDetails.get(stock.stockCode)!.contribution!.toFixed(3) + '%' }}
                            </b>
                          </div>
                        </div>

                        <div class="hx-tags">
                          <span class="hx-tag" :class="{ 'is-warn': stockDetails.get(stock.stockCode)!.noMarket }">
                            <em>市场</em><b>{{ stockDetails.get(stock.stockCode)!.marketLabel }}</b>
                          </span>
                          <span class="hx-tag" :class="{ 'is-warn': stockDetails.get(stock.stockCode)!.shareClassRaw === 'unknown' }">
                            <em>档位</em><b>{{ stockDetails.get(stock.stockCode)!.shareClass }}</b>
                          </span>
                          <span class="hx-tag" :class="{ 'is-warn': stockDetails.get(stock.stockCode)!.viaYahoo }">
                            <em>接口</em><b>{{ stockDetails.get(stock.stockCode)!.source }}</b>
                          </span>
                          <span class="hx-tag" :data-tone="stockDetails.get(stock.stockCode)!.statusTone">
                            <em>状态</em><b>{{ stockDetails.get(stock.stockCode)!.status }}</b>
                          </span>
                          <span v-if="stockDetails.get(stock.stockCode)!.session" class="hx-tag">
                            <em>时段</em><b>{{ stockDetails.get(stock.stockCode)!.session }}</b>
                          </span>
                        </div>

                        <dl class="hx-rows">
                          <div class="hx-row">
                            <dt>交易状态</dt>
                            <dd>{{ stockDetails.get(stock.stockCode)!.tradingState }}<span class="hx-row-sub">{{ stockDetails.get(stock.stockCode)!.tz === '—' ? '' : ' · ' + stockDetails.get(stock.stockCode)!.tz + ' 时区' }}</span></dd>
                          </div>
                          <div class="hx-row">
                            <dt>取数通道</dt>
                            <dd>{{ stockDetails.get(stock.stockCode)!.marketDesc }}</dd>
                          </div>
                          <div class="hx-row">
                            <dt>{{ holdingsMode === 'close' ? '数据日期' : '更新时间' }}</dt>
                            <dd class="font-number">{{ stockDetails.get(stock.stockCode)!.updatedAt }}</dd>
                          </div>
                          <div class="hx-row">
                            <dt>原始条目</dt>
                            <dd class="font-number">{{ stockDetails.get(stock.stockCode)!.raw }}</dd>
                          </div>
                        </dl>
                      </template>
                      </div>
                    </div>
                  </div>
                </Transition>
              </li>
            </ul>
          </template>
          <template v-else-if="fundInfo && fundInfo.topHoldings && fundInfo.topHoldings.length > 0">
            <ul class="hx-list">
              <li v-for="(stock, idx) in fundInfo.topHoldings" :key="stock.stockCode" class="hx-item">
                <div class="hx-main is-static">
                  <span class="hx-bar" :style="{ width: ratioBarWidth(stock.ratio) }" aria-hidden="true"></span>
                  <span class="hx-rank font-number">{{ String(idx + 1).padStart(2, '0') }}</span>
                  <span class="hx-ident">
                    <span class="hx-name">{{ stock.stockName }}</span>
                    <span class="hx-meta"><span class="hx-code font-number">{{ stock.stockCode }}</span></span>
                  </span>
                  <span class="hx-ratio">
                    <span class="hx-ratio-v font-number">{{ stock.ratio > 0 ? stock.ratio.toFixed(2) : '--' }}</span>
                    <span v-if="stock.ratio > 0" class="hx-ratio-u">%</span>
                  </span>
                  <span class="hx-chg font-number text-muted">--</span>
                </div>
              </li>
            </ul>
          </template>
          <p v-else class="dp-empty">暂无持仓数据</p>
        </template>
        <template v-else-if="activeTab === 'alloc'">
          <div v-if="detailLoading" class="dp-empty"><span class="animate-breathe">加载中...</span></div>
          <template v-else-if="allocRows.length > 0 || positionTrendOption || allocHistoryRows.length > 0">
            <template v-if="allocRows.length > 0">
            <p class="dp-panel-cap">最新报告期资产配置，按占净值比例</p>
            <div class="ac-stack" role="img" aria-label="资产配置占比">
              <i v-for="a in allocRows" :key="a.category" :data-c="a.tone"
                 :style="{ width: Math.max(a.ratio, 0.5) + '%' }" :title="`${a.category} ${a.ratio.toFixed(2)}%`" />
              <i v-if="allocOther > 0" data-c="other" :style="{ width: allocOther + '%' }" :title="`其他 ${allocOther.toFixed(2)}%`" />
            </div>
            <div class="ac-list">
              <div v-for="a in allocRows" :key="a.category" class="ac-item">
                <span class="ac-dot" :data-c="a.tone" />
                <span class="ac-name">{{ a.category }}</span>
                <span class="ac-bar"><i :data-c="a.tone" :style="{ width: Math.min(a.ratio, 100) + '%' }" /></span>
                <span class="ac-val font-number">{{ a.ratio.toFixed(2) }}%</span>
              </div>
              <div v-if="allocOther > 0" class="ac-item">
                <span class="ac-dot" data-c="other" />
                <span class="ac-name">其他</span>
                <span class="ac-bar"><i data-c="other" :style="{ width: Math.min(allocOther, 100) + '%' }" /></span>
                <span class="ac-val font-number">{{ allocOther.toFixed(2) }}%</span>
              </div>
            </div>
            <div class="ac-sum">
              <div class="ac-sum-cell">
                <em>基金规模</em><b>{{ fundInfo?.fundScale || '--' }}</b>
              </div>
              <div class="ac-sum-cell">
                <em>股票仓位</em>
                <b class="font-number">{{ stockPosition != null ? stockPosition.toFixed(2) + '%' : '--' }}</b>
              </div>
              <div class="ac-sum-cell">
                <em>合计披露</em>
                <b class="font-number">{{ allocTotal.toFixed(2) }}%</b>
              </div>
            </div>
            <p class="ac-note">
              仓位越高，净值随市场波动越大。数据来自最新定期报告，与当前实际持仓可能存在偏差。
              <template v-if="allocTotal < 95">披露合计不足 100%，未列明部分已归入「其他」。</template>
            </p>
            </template>

            <div v-if="positionTrendOption" class="pt-wrap">
              <p class="dp-panel-cap">股票仓位测算走势</p>
              <v-chart :option="positionTrendOption" autoresize class="pt-chart" />
            </div>

            <div v-if="allocHistoryRows.length > 1" class="ph-wrap">
              <p class="dp-panel-cap">历年报告期配置</p>
              <div v-for="row in allocHistoryRows" :key="row.period" class="ph-row">
                <div class="ph-head">
                  <span class="ph-period font-number">{{ row.period }}</span>
                  <span v-if="row.netAsset != null" class="ph-net font-number">净资产 {{ row.netAsset.toFixed(2) }} 亿</span>
                </div>
                <div class="ph-stack">
                  <i v-for="it in row.items" :key="it.name" :data-c="it.tone"
                     :style="{ width: Math.max(it.value, 0) + '%' }" :title="`${it.name} ${it.value.toFixed(2)}%`" />
                </div>
                <div class="ph-legend">
                  <span v-for="it in row.items" :key="it.name" class="ph-leg">
                    <i :data-c="it.tone" />{{ it.name }} <b class="font-number">{{ it.value.toFixed(2) }}%</b>
                  </span>
                </div>
              </div>
            </div>
          </template>
          <p v-else class="dp-empty">暂无资产配置数据</p>
        </template>
        <template v-else-if="activeTab === 'risk'">
          <div v-if="chartLoading" class="dp-empty"><span class="animate-breathe">加载中...</span></div>
          <template v-else-if="riskMetrics">
            <p class="dp-panel-cap">基于近 {{ riskMetrics.sampleDays }} 个交易日净值本地测算</p>
            <div class="info-grid">
              <div class="info-card">
                <span class="info-label">年化波动率</span>
                <span class="info-val font-number">{{ riskMetrics.volatility.toFixed(2) }}%</span>
              </div>
              <div class="info-card">
                <span class="info-label">最大回撤</span>
                <span class="info-val font-number text-fall">-{{ riskMetrics.maxDrawdown.toFixed(2) }}%</span>
              </div>
              <div class="info-card">
                <span class="info-label">夏普比率</span>
                <span :class="['info-val font-number', riskMetrics.sharpe > 0 ? 'text-rise' : riskMetrics.sharpe < 0 ? 'text-fall' : '']">
                  {{ riskMetrics.sharpe.toFixed(2) }}
                </span>
              </div>
              <div class="info-card">
                <span class="info-label">年化收益</span>
                <span :class="['info-val font-number', riskMetrics.annualReturn > 0 ? 'text-rise' : riskMetrics.annualReturn < 0 ? 'text-fall' : '']">
                  {{ riskMetrics.annualReturn > 0 ? '+' : '' }}{{ riskMetrics.annualReturn.toFixed(2) }}%
                </span>
              </div>
              <div class="info-card">
                <span class="info-label">上涨天数占比</span>
                <span class="info-val font-number">{{ riskMetrics.winRate.toFixed(1) }}%</span>
              </div>
              <div class="info-card">
                <span class="info-label">单日最大跌幅</span>
                <span class="info-val font-number text-fall">{{ riskMetrics.worstDay.toFixed(2) }}%</span>
              </div>
            </div>
            <p class="dp-risk-note">
              指标由本地净值序列计算，仅供参考。夏普比率按无风险利率 {{ RISK_FREE_RATE }}% 估算。
            </p>
          </template>
          <p v-else class="dp-empty">净值数据不足，无法测算风险指标</p>
        </template>
        <template v-else-if="activeTab === 'info'">
          <div v-if="detailLoading" class="dp-empty"><span class="animate-breathe">加载中...</span></div>
          <template v-else-if="fundInfo">
            <div class="info-grid">
              <div class="info-card"><span class="info-label">基金类型</span><span class="info-val">{{ fundInfo.fundType || '--' }}</span></div>
              <div class="info-card"><span class="info-label">基金经理</span><span class="info-val">{{ fundInfo.fundManager || '--' }}</span></div>
              <div class="info-card">
                <span class="info-label">同类排名</span>
                <span class="info-val font-number">{{ fundInfo.peerRanking || '--' }}</span>
              </div>
              <div class="info-card"><span class="info-label">净值更新</span><span class="info-val font-number">{{ fundInfo.dayGrowthDate || '--' }}</span></div>
              <div class="info-card"><span class="info-label">成立日期</span><span class="info-val font-number">{{ baseInfo?.establishDate || fundInfo.establishDate || '--' }}</span></div>
              <div v-if="baseInfo?.company" class="info-card"><span class="info-label">基金公司</span><span class="info-val">{{ baseInfo.company }}</span></div>
              <div v-if="baseInfo?.riskLevel" class="info-card"><span class="info-label">风险等级</span><span class="info-val">{{ baseInfo.riskLevel }}</span></div>
              <div v-if="baseInfo?.confirmDays" class="info-card"><span class="info-label">确认天数</span><span class="info-val font-number">T+{{ baseInfo.confirmDays }}</span></div>
              <div class="info-card"><span class="info-label">基金规模</span><span class="info-val font-number">{{ fundInfo.fundScale || '--' }}</span></div>
              <div class="info-card"><span class="info-label">申购费率</span><span class="info-val">{{ fundInfo.purchaseRate ? fundInfo.purchaseRate + '%' : '--' }}</span></div>
              <div class="info-card"><span class="info-label">最低申购</span><span class="info-val">{{ fundInfo.minPurchase ? fundInfo.minPurchase + '元' : '--' }}</span></div>
              <div class="info-card"><span class="info-label">申购状态</span><span :class="['info-val', fundInfo.purchaseStatus === '开放' ? 'text-rise' : 'text-fall']">{{ fundInfo.purchaseStatus || '--' }}</span></div>
              <div class="info-card"><span class="info-label">赎回状态</span><span :class="['info-val', fundInfo.redeemStatus === '开放' ? 'text-rise' : 'text-fall']">{{ fundInfo.redeemStatus || '--' }}</span></div>
            </div>

            <div v-if="managers.length > 0" class="mg-wrap">
              <p class="dp-panel-cap">现任基金经理 · {{ managers.length }} 位</p>
              <div v-for="(m, mi) in managers" :key="m.name" class="mg-card">
                <div class="mg-head">
                  <span class="mg-name">{{ m.name }}</span>
                  <span v-if="m.star > 0" class="mg-star" :title="`${m.star} 星`">
                    <i v-for="s in 5" :key="s" :class="['mg-star-i', s <= m.star && 'is-on']">★</i>
                  </span>
                  <span v-if="m.powerAvg > 0" class="mg-avg font-number">综合 {{ m.powerAvg.toFixed(1) }}</span>
                </div>
                <div class="mg-meta">
                  <span v-if="m.workTime">从业 {{ m.workTime }}</span>
                  <span v-if="m.fundSize">管理 {{ m.fundSize }}</span>
                </div>
                <div v-if="managerRadarOptions[mi]" class="mg-radar">
                  <v-chart :option="managerRadarOptions[mi]" autoresize class="mg-radar-c" />
                </div>
                <div v-else-if="m.power.length > 0" class="mg-bars">
                  <div v-for="p in m.power" :key="p.label" class="alloc-item">
                    <div class="alloc-bar-row">
                      <span class="alloc-label">{{ p.label }}</span>
                      <span class="alloc-val font-number">{{ p.value.toFixed(1) }}</span>
                    </div>
                    <div class="alloc-bar-bg"><div class="alloc-bar-fill" :style="{ width: Math.min(p.value, 100) + '%' }"></div></div>
                  </div>
                </div>
                <div v-if="m.tenureReturn != null" class="mg-profit">
                  <div class="mg-profit-cell">
                    <em>任期收益</em>
                    <b :class="['font-number', m.tenureReturn > 0 ? 'text-rise' : m.tenureReturn < 0 ? 'text-fall' : '']">
                      {{ m.tenureReturn > 0 ? '+' : '' }}{{ m.tenureReturn.toFixed(2) }}%
                    </b>
                  </div>
                  <div v-if="m.peerReturn != null" class="mg-profit-cell">
                    <em>同类平均</em>
                    <b class="font-number text-muted">{{ m.peerReturn > 0 ? '+' : '' }}{{ m.peerReturn.toFixed(2) }}%</b>
                  </div>
                  <div v-if="m.peerReturn != null" class="mg-profit-cell">
                    <em>超额</em>
                    <b :class="['font-number', m.tenureReturn - m.peerReturn > 0 ? 'text-rise' : 'text-fall']">
                      {{ m.tenureReturn - m.peerReturn > 0 ? '+' : '' }}{{ (m.tenureReturn - m.peerReturn).toFixed(2) }}%
                    </b>
                  </div>
                </div>
              </div>
            </div>
          </template>
          <p v-else class="dp-empty">暂无详情数据</p>
        </template>
        <template v-else>
          <div v-if="detailLoading" class="dp-empty"><span class="animate-breathe">加载中...</span></div>
          <template v-else-if="(fundInfo?.holderStructure?.length ?? 0) > 0 || scaleRows.length > 0 || buySedemptionRows.length > 0">
            <template v-if="(fundInfo?.holderStructure?.length ?? 0) > 0">
              <p class="dp-panel-cap">最新报告期持有人结构</p>
              <div v-for="item in fundInfo!.holderStructure" :key="item.holderType" class="alloc-item">
                <div class="alloc-bar-row">
                  <span class="alloc-label">{{ item.holderType }}</span>
                  <span class="alloc-val font-number">{{ item.ratio.toFixed(2) }}%</span>
                </div>
                <div class="alloc-bar-bg"><div class="alloc-bar-fill" :style="{ width: Math.min(item.ratio, 100) + '%' }"></div></div>
              </div>
            </template>

            <div v-if="holderHistoryRows.length > 1" class="ph-wrap">
              <p class="dp-panel-cap">历年报告期结构变化</p>
              <div v-for="row in holderHistoryRows" :key="row.period" class="ph-row">
                <div class="ph-head"><span class="ph-period font-number">{{ row.period }}</span></div>
                <div class="ph-stack">
                  <i v-for="(it, i) in row.items" :key="it.name" :data-h="i"
                     :style="{ width: Math.max(it.value, 0) + '%' }" :title="`${it.name} ${it.value.toFixed(2)}%`" />
                </div>
                <div class="ph-legend">
                  <span v-for="(it, i) in row.items" :key="it.name" class="ph-leg">
                    <i :data-h="i" />{{ it.name }} <b class="font-number">{{ it.value.toFixed(2) }}%</b>
                  </span>
                </div>
              </div>
            </div>

            <div v-if="scaleRows.length > 0" class="sc-wrap">
              <p class="dp-panel-cap">基金规模变动 · 单位亿元</p>
              <div v-for="s in scaleRows" :key="s.period" class="sc-row">
                <span class="sc-period font-number">{{ s.period }}</span>
                <span class="sc-bar"><i :style="{ width: (scaleMax > 0 ? (s.scale / scaleMax * 100) : 0) + '%' }" /></span>
                <span class="sc-val font-number">{{ s.scale.toFixed(2) }}</span>
                <span v-if="s.momValue != null"
                      :class="['sc-mom font-number', s.momValue > 0 ? 'text-rise' : s.momValue < 0 ? 'text-fall' : 'text-muted']">
                  {{ s.momValue > 0 ? '+' : '' }}{{ s.mom }}
                </span>
                <span v-else class="sc-mom text-muted">--</span>
              </div>
            </div>

            <div v-if="buySedemptionRows.length > 0" class="bs-wrap">
              <p class="dp-panel-cap">申购赎回 · 单位亿份</p>
              <div class="bs-table">
                <div class="bs-head">
                  <span>报告期</span>
                  <span v-for="s in buySedemptionRows[0].items" :key="s.name">{{ s.name }}</span>
                </div>
                <div v-for="row in buySedemptionRows" :key="row.period" class="bs-row">
                  <span class="font-number">{{ row.period }}</span>
                  <span v-for="it in row.items" :key="it.name" class="font-number">{{ it.value.toFixed(2) }}</span>
                </div>
              </div>
            </div>
          </template>
          <p v-else class="dp-empty">暂无持有人结构数据</p>
        </template>
      </section>
    </div>
    <footer class="dp-actions">
      <template v-if="holdingAmount > 0">
        <button class="dp-act" @click="openOp('reduce')">减仓</button>
        <button class="dp-act dp-act-primary" @click="openOp('add')">加仓</button>
        <button class="dp-act dp-act-icon" title="编辑持仓" @click="openOp('edit')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
        </button>
        <button class="dp-act dp-act-icon dp-act-danger" title="清空持仓" @click="handleClearHolding">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
        </button>
      </template>
      <button v-else class="dp-act dp-act-primary dp-act-wide" @click="openOp('edit')">录入持仓</button>
      <button class="dp-act dp-act-icon dp-act-remove" title="删除基金" @click="handleRemoveFund">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
      </button>
    </footer>
    <BottomSheet :visible="!!activeOp" :title="opTitle" center :mask-closable="false" @update:visible="(v) => { if (!v) closeOp() }">
      <div class="dp-form">
        <template v-if="activeOp === 'add'">
          <div class="dp-field">
            <label class="dp-label">投入金额</label>
            <div class="dp-input-wrap">
              <span class="dp-unit">¥</span>
              <input v-model.number="opForm.amount" type="number" min="0" class="dp-input" placeholder="0.00" />
            </div>
          </div>
          <p class="dp-hint">参考净值 {{ referenceNav.toFixed(4) }}</p>
        </template>
        <template v-else-if="activeOp === 'reduce'">
          <div class="dp-field">
            <label class="dp-label">赎回份额</label>
            <div class="dp-input-wrap">
              <input v-model.number="opForm.shares" type="number" min="0" class="dp-input" placeholder="0.00" />
              <span class="dp-unit dp-unit-suffix">份</span>
            </div>
          </div>
          <p class="dp-hint">当前持有 {{ currentShares.toFixed(2) }} 份</p>
        </template>
        <template v-else-if="activeOp === 'edit'">
          <div class="dp-field">
            <label class="dp-label">持仓金额</label>
            <div class="dp-input-wrap">
              <span class="dp-unit">¥</span>
              <input v-model.number="opForm.holdingAmount" type="number" min="0" class="dp-input" placeholder="0.00" />
            </div>
          </div>
          <div class="dp-field">
            <label class="dp-label">累计收益</label>
            <div class="dp-input-wrap">
              <span class="dp-unit">¥</span>
              <input v-model.number="opForm.totalProfit" type="number" class="dp-input" placeholder="正盈负亏" />
            </div>
          </div>
          <p class="dp-hint">投入本金 ¥{{ Math.max(0, (opForm.holdingAmount || 0) - (opForm.totalProfit || 0)).toFixed(2) }}</p>
        </template>
      </div>
      <template #footer>
        <button class="dp-fbtn" @click="closeOp">取消</button>
        <button class="dp-fbtn dp-fbtn-primary" @click="submitOp">确认</button>
      </template>
    </BottomSheet>
  </div>
</template>
<script setup lang="ts">

import { ref, shallowRef, computed, watch, onMounted, reactive, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { LineChart, RadarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { removeFundFromActiveGroup } from '@/modules/group/group-actions'
import { getTradeMarks, anchorMarks, anchorMarksByTime, describeMarks, findDateByNav, type TradeMark } from '@/modules/holding/trade-marks'
import { useSettingsStore } from '@/modules/settings/settings-store'
import type { FundAllHoldings, HoldingDetailItem } from '@/modules/fund/fund-types'
import type { FundFullInfo as FundInfo } from '@/modules/fund/services/fund-full-data-fetch'
import { getFundFullData } from '@/modules/fund/services/fund-full-data-fetch'
import { peekNavSeries, peekPerfItems, fetchMissingPerf } from '@/modules/fund/perf/perf-intervals'
import { stockQuoteMode, detailChartRange, detailTab, detailScrollTop, type DetailTabKey, type DetailRangeKey } from '@/composables/use-view-prefs'
import { fetchFundBaseInfo, type FundBaseInfo } from '@/modules/fund/services/fund-base-info'
import { fetchIntradayEstimate } from '@/modules/fund/intraday/intraday-estimate-fetch'
import { isCnMarketOpenForIntraday, keepTodayPoints } from '@/modules/fund/intraday/intraday-points'
import { getPreviousTradingDay, getBeijingTodayStr, isCnTradingDay } from '@/modules/fund/valuation/cn-trading-day'
import { getConfirmType, confirmTypeLabel } from '@/modules/fund/valuation/fund-type'
import { confirm } from '@/composables/use-confirm'
import { formatValuationTimeWithSeconds } from '@/shared/utils/date-format'
import { formatProfitCompact, formatCompactMoney } from '@/shared/utils/money-format'
import { useEstimatedHoldings } from '@/composables/use-estimated-holdings'
import { useChartScrub } from '@/composables/use-chart-scrub'
import PendingPlanList from '@/components/shared/pending-plan-list.vue'
import BottomSheet from '@/components/shared/bottom-sheet.vue'
import { classifyShare } from '@/shared/market/market-classify'
import { stockMarketToTz } from '@/shared/market/market-classify'
import { resolveMarketTradingDays } from '@/shared/market/trading-day'
import { computeEstimatedGszzlFromPrevDay } from '@/modules/fund/calc/gszzl-weight'
import { EM_MARKET_LABEL } from '@/shared/market/em-market-map'
import type { StockQuoteInfo } from '@/shared/types/common-types'

use([LineChart, RadarChart, GridComponent, TooltipComponent, DataZoomComponent, MarkLineComponent, MarkPointComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{ fundCode: string; isActive?: boolean }>()
const router = useRouter()
const fundStore = useFundStore()
const holdingStore = useHoldingStore()
const groupStore = useGroupStore()
const settingsStore = useSettingsStore()
const p = computed(() => settingsStore.privacy)

function goBack(): void {
  const hasPrev = !!window.history.state?.back
  if (hasPrev) {
    router.back()
  } else {
    router.replace('/')
  }
}

const fundCode = computed(() => props.fundCode)

const fundName = computed(() => fundStore.resolveFundName(fundCode.value))

const isEstimated = computed(() => fundStore.getValuation(fundCode.value)?.isEstimated ?? true)
const staleAsOf = computed(() => fundStore.getValuation(fundCode.value)?.staleAsOf ?? '')
const currentGszzl = computed(() => fundStore.getValuation(fundCode.value)?.gszzl ?? 0)
const delayDays = computed(() => fundStore.getValuation(fundCode.value)?.delayDays ?? 1)

const confirmTypeText = computed(() => confirmTypeLabel(getConfirmType(delayDays.value)))
const realtimeGszzl = computed(() => fundStore.getValuation(fundCode.value)?.realtimeGszzl ?? null)
const realtimeSource = computed(() => fundStore.getValuation(fundCode.value)?.realtimeSource ?? '')

function splitYear(s: string): { year: string; rest: string } {
  const m = s.match(/^(\d{4})-(.+)$/)
  return m ? { year: `${m[1]}-`, rest: m[2] } : { year: '', rest: s }
}

const realtimeTimeStr = computed(() => {
  const at = fundStore.getValuation(fundCode.value)?.realtimeUpdatedAt
  if (!at) return { year: '', rest: '--' }
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(at)) return splitYear(`${getBeijingTodayStr()} ${at}`)
  return splitYear(at)
})

const hasHoldingsRatio = computed(() => {
  const hs = displayHoldings.value?.holdings
  return !!hs && hs.some(h => (h.ratio ?? 0) > 0)
})
const isHiddenRtSource = computed(() => {
  if (realtimeSource.value !== '实时') return false
  return !hasHoldingsRatio.value
})

const rateColor = computed(() => {
  if (currentGszzl.value > 0) return 'text-rise'
  if (currentGszzl.value < 0) return 'text-fall'
  return 'text-flat'
})
const rateSign = computed(() => currentGszzl.value > 0 ? '+' : '')

const valuationTimeStr = computed(() => {
  const v = fundStore.getValuation(fundCode.value)
  if (!v) return { year: '', rest: '--' }
  if (!isCnTradingDay()) return splitYear(formatValuationTimeWithSeconds(getPreviousTradingDay()))
  const valTime = v.delayDays === 2
    ? getPreviousTradingDay()
    : (v.isEstimated ? (v.gztime ?? '') : getBeijingTodayStr())
  return splitYear(formatValuationTimeWithSeconds(valTime))
})

const currentShares = computed(() => holdingStore.getTotalShares(fundCode.value))
const referenceNav = computed(() => fundStore.getValuation(fundCode.value)?.dwjz ?? 0)

const holdingAmount = computed(() => {
  const v = fundStore.getValuation(fundCode.value)
  return holdingStore.getFundHoldingAmount(fundCode.value, v?.dwjz, v?.gszzl, v?.isEstimated)
})
const todayProfit = computed(() => {
  const v = fundStore.getValuation(fundCode.value)
  return holdingStore.calcFundTodayProfit(fundCode.value, 0, v?.dwjz, v?.gszzl, v?.isEstimated, holdingStore.resolveGszzlDate(v))
})

const principal = computed(() => holdingStore.getPrincipal(fundCode.value))
const totalProfit = computed(() => {
  if (holdingAmount.value <= 0) return 0
  return holdingAmount.value - principal.value
})
const totalReturnRate = computed(() => {
  if (principal.value <= 0) return 0
  return (totalProfit.value / principal.value) * 100
})

const TABS: { key: DetailTabKey; label: string }[] = [
  { key: 'stocks', label: '持仓股' },
  { key: 'perf', label: '业绩' },
  { key: 'risk', label: '风险' },
  { key: 'info', label: '资料' },
  { key: 'alloc', label: '资金配置' },
  { key: 'holder', label: '持有人' },
]
const activeTab = detailTab

const detailBodyEl = ref<HTMLElement | null>(null)
const bodyScrolled = ref(false)

function onBodyScroll(): void {
  const top = detailBodyEl.value?.scrollTop ?? 0
  bodyScrolled.value = top > 2
  if (props.isActive !== false) detailScrollTop.value = top
}

function selectTab(key: DetailTabKey, e: MouseEvent): void {
  activeTab.value = key
  detailScrollTop.value = 0
  const el = e.currentTarget as HTMLElement | null
  el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
}

function toneOf(v: number): string {
  return v > 0 ? 'text-rise' : v < 0 ? 'text-fall' : 'text-flat'
}

const holdingsSummary = computed(() => {
  const d = displayHoldings.value
  if (!d) return ''
  return [d.reportType, d.reportDate].filter(Boolean).join(' · ')
})

const holdingsTotalRatio = computed(() => {
  const hs = displayHoldings.value?.holdings ?? []
  return hs.reduce((s, h) => s + (h.ratio ?? 0), 0)
})

const holdingsQuoteReady = computed(() => {
  const hs = displayHoldings.value?.holdings ?? []
  return hs.filter(h => stockChange(h) != null).length
})

const holdingsMissingRatio = computed(() => {
  const hs = displayHoldings.value?.holdings ?? []
  return hs.reduce((s, h) => s + (stockChange(h) == null ? (h.ratio ?? 0) : 0), 0)
})

const holdingsQuotePartial = computed(() => {
  const hs = displayHoldings.value?.holdings ?? []
  return hs.length > 0 && holdingsQuoteReady.value < hs.length && holdingsWeightedChange.value != null
})

const holdingsWeightedChange = computed(() => {
  const hs = displayHoldings.value?.holdings ?? []
  if (hs.length === 0) return null

  const src = holdingsMode.value === 'close' ? prevDayMap.value : realtimeMap.value
  const usable = new Map<string, StockQuoteInfo>()
  for (const h of hs) {
    const info = src.get(h.stockCode)
    if (!info || info.changeRate == null) continue
    if (holdingsMode.value === 'realtime' && !isRealtimeEntryFresh(info)) continue
    usable.set(h.stockCode, info)
  }
  return computeEstimatedGszzlFromPrevDay(hs, usable)
})

function isRealtimeEntryFresh(info: StockQuoteInfo): boolean {
  if (info.closed) return true
  if (!info.market) return false
  const curTd = resolveMarketTradingDays(stockMarketToTz(info.market)).currentTradingDay
  return !!info.date && info.date === curTd
}

const ratioBarMax = computed(() => {
  const hs = displayHoldings.value?.holdings ?? fundInfo.value?.topHoldings ?? []
  return hs.reduce((m, h) => Math.max(m, h.ratio ?? 0), 0)
})

function ratioBarWidth(ratio: number): string {
  const max = ratioBarMax.value
  if (!(ratio > 0) || max <= 0) return '0%'
  return `${Math.max((ratio / max) * 100, 4).toFixed(1)}%`
}

const activeOp = ref<'add' | 'reduce' | 'edit' | null>(null)

const opTitle = computed(() => {
  if (activeOp.value === 'add') return '加仓'
  if (activeOp.value === 'reduce') return '减仓'
  return holdingAmount.value > 0 ? '编辑持仓' : '录入持仓'
})

function openOp(type: 'add' | 'reduce' | 'edit'): void {
  toggleOp(type)

  if (!activeOp.value) toggleOp(type)
}

function submitOp(): void {
  if (activeOp.value === 'add') submitAdd()
  else if (activeOp.value === 'reduce') submitReduce()
  else if (activeOp.value === 'edit') submitEdit()
}
const opForm = reactive<{ amount: number | ''; shares: number | ''; holdingAmount: number | ''; totalProfit: number | '' }>({
  amount: '',
  shares: '',
  holdingAmount: '',
  totalProfit: '',
})

function toggleOp(type: 'add' | 'reduce' | 'edit'): void {
  if (activeOp.value === type) {
    activeOp.value = null
    return
  }
  if (type === 'edit') {
    opForm.holdingAmount = holdingAmount.value > 0 ? parseFloat(holdingAmount.value.toFixed(2)) : ''
    opForm.totalProfit = holdingAmount.value > 0 ? parseFloat(totalProfit.value.toFixed(2)) : ''
  }
  activeOp.value = type
}

function closeOp(): void { activeOp.value = null }

function submitAdd(): void {
  if (!opForm.amount || opForm.amount <= 0) { ElMessage.warning('请输入有效金额'); return }
  const nav = referenceNav.value
  if (nav <= 0) { ElMessage.warning('当前净值不可用'); return }
  holdingStore.createPendingAdd(fundCode.value, opForm.amount, nav, delayDays.value)
  ElMessage.success('加仓申请已提交，待净值确认后生效')
  opForm.amount = ''
  closeOp()
}

function submitReduce(): void {
  if (!opForm.shares || opForm.shares <= 0) { ElMessage.warning('请输入有效份额'); return }
  const nav = referenceNav.value
  if (nav <= 0) { ElMessage.warning('当前净值不可用'); return }
  holdingStore.createPendingReduce(fundCode.value, opForm.shares, nav, delayDays.value)
  ElMessage.success('减仓申请已提交，待净值确认后生效')
  opForm.shares = ''
  closeOp()
}

function submitEdit(): void {
  if (!opForm.holdingAmount || opForm.holdingAmount <= 0) { ElMessage.warning('请输入持仓金额'); return }
  const nav = referenceNav.value > 0 ? referenceNav.value : 1
  const amount = opForm.holdingAmount
  const profit = opForm.totalProfit === '' ? 0 : opForm.totalProfit
  const shares = amount / nav
  const v = fundStore.getValuation(fundCode.value)

  // 成本价由「持仓金额 - 累计收益」反推，再回溯到最接近的历史交易日，
  // 让标记落在真实建仓点而非今天。
  const principal = amount - profit
  const costNav = shares > 0 && principal > 0 ? principal / shares : nav
  const markDate = findDateByNav(
    historyData.value.map(d => ({ d: d.date, v: d.value })),
    costNav,
  )

  holdingStore.replaceHoldingDirect(
    fundCode.value, shares, costNav, amount, profit,
    { gszzl: v?.gszzl, isEstimated: v?.isEstimated, jzrq: v?.jzrq },
    markDate,
  )
  ElMessage.success('持仓已更新')
  closeOp()
}

async function handleClearHolding(): Promise<void> {
  const ok = await confirm({
    title: '清空持仓',
    desc: '将该基金的持仓归零，基金仍保留在自选列表中。',
    confirmText: '确认清空',
    cancelText: '取消',
  })
  if (!ok) return
  holdingStore.settleAllByFund(fundCode.value)
  ElMessage.success('已清空持仓')
}

async function handleRemoveFund(): Promise<void> {
  const ok = await confirm({
    title: '删除基金',
    desc: holdingAmount.value > 0
      ? '该基金仍有持仓记录，从当前分组删除后将一并移除该分组的持仓数据，且不可恢复。'
      : '将该基金移出当前分组。',
    confirmText: '确认删除',
    cancelText: '取消',
  })
  if (!ok) return
  const code = fundCode.value

  removeFundFromActiveGroup(code)
  ElMessage.success('已删除基金')
  goBack()
}

const RANGES: { key: DetailRangeKey; label: string; days: number }[] = [
  { key: 'today', label: '当日', days: 0 },
  { key: 'm1', label: '1月', days: 30 },
  { key: 'm3', label: '3月', days: 90 },
  { key: 'm6', label: '6月', days: 180 },
  { key: 'y1', label: '1年', days: 365 },
  { key: 'all', label: '全部', days: 0 },
]
const chartRange = detailChartRange
const chartMode = computed<'intraday' | 'history'>(() => chartRange.value === 'today' ? 'intraday' : 'history')
const chartLoading = ref(false)
const historyData = ref<{ date: string; value: number }[]>([])

const rangedHistory = computed<{ date: string; value: number }[]>(() => {
  const list = historyData.value
  const r = RANGES.find(x => x.key === chartRange.value)
  if (!r || r.days <= 0 || list.length === 0) return list
  const lastMs = Date.parse(list[list.length - 1].date)
  if (!Number.isFinite(lastMs)) return list
  const cutoff = lastMs - r.days * 86400000
  const cut = list.filter(d => {
    const t = Date.parse(d.date)
    return Number.isFinite(t) && t >= cutoff
  })

  return cut.length >= 2 ? cut : list
})

const changeRate = computed(() => fundStore.getValuation(fundCode.value)?.gszzl ?? 0)
const baselineNav = computed(() => {
  const v = fundStore.getValuation(fundCode.value)
  if (!v || v.dwjz <= 0) return 0
  const isT2val = v.delayDays === 2 || (v.delayDays == null && v.gztime && !v.gztime.includes(':'))
  if (isT2val) return v.dwjz
  if (v.gszzl !== 0 && !v.isEstimated) return v.dwjz / (1 + v.gszzl / 100)
  return v.dwjz
})

const intradayPoints = computed(() => keepTodayPoints(fundStore.intradayMap[fundCode.value]))
const isT2fund = computed(() => {
  const v = fundStore.getValuation(fundCode.value)
  return v?.delayDays === 2 || (v?.delayDays == null && v?.gztime && !v.gztime.includes(':'))
})

const readoutRows = computed<{ label: string; nav: number; change: string }[]>(() => {
  if (chartMode.value === 'intraday') {
    const base = baselineNav.value
    const cr = changeRate.value
    return intradayPoints.value.map(p => ({
      label: p.time,
      nav: p.value,

      change: isT2fund.value
        ? `${cr >= 0 ? '+' : ''}${cr.toFixed(2)}%`
        : base > 0
          ? `${(p.value - base) / base * 100 >= 0 ? '+' : ''}${((p.value - base) / base * 100).toFixed(2)}%`
          : '--',
    }))
  }
  const hist = rangedHistory.value
  return hist.map((d, i) => {
    const prev = i === 0 ? 0 : hist[i - 1].value
    const chg = i === 0 || prev === 0 ? null : (d.value - prev) / prev * 100
    return {
      label: d.date,
      nav: d.value,
      change: chg == null ? '--' : `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`,
    }
  })
})

const intradayChartRef = shallowRef<any>(null)
const historyChartRef = shallowRef<any>(null)

const scrub = useChartScrub({
  count: () => readoutRows.value.length,
  pixelToIndex: (x: number) => {
    const inst = chartMode.value === 'intraday' ? intradayChartRef.value : historyChartRef.value
    if (!inst?.convertFromPixel) return null
    try {
      const r = inst.convertFromPixel({ xAxisIndex: 0 }, [x, 0])
      const idx = Array.isArray(r) ? r[0] : r
      return typeof idx === 'number' && Number.isFinite(idx) ? idx : null
    } catch { return null }
  },
})

const { containerRef: scrubContainer, lineLeft: scrubLineLeft } = scrub

const activeReadout = computed(() => {
  const i = scrub.activeIndex.value
  if (i == null) return null
  return readoutRows.value[i] ?? null
})

const tradeMarks = computed<TradeMark[]>(() =>
  getTradeMarks(holdingStore.groupActions, holdingStore.groupPendingActions, fundCode.value, groupStore.activeGroupId))

const MARK_COLORS = {
  buy: 'rgba(239,68,68,0.92)',
  sell: 'rgba(34,197,94,0.92)',
  settle: 'rgba(148,163,184,0.95)',
} as const

function summarizeAnchor(marks: TradeMark[]): { label: string; color: string; size: number } {
  const kinds = new Set(marks.map(m => (m.side === 'buy' ? 'B' : m.side === 'settle' ? 'S' : 'T')))
  const label = [...kinds].join('/')
  const primary = marks[marks.length - 1]?.side ?? 'buy'
  return {
    label,
    color: MARK_COLORS[primary],
    size: label.length > 1 ? 26 : 18,
  }
}

const markAnchors = computed(() =>
  anchorMarks(
    rangedHistory.value.map(d => d.date),
    tradeMarks.value,
    rangedHistory.value.map(d => d.value),
  ))

const intradayMarkAnchors = computed(() =>
  anchorMarksByTime(intradayPoints.value.map(p => p.time), tradeMarks.value, getBeijingTodayStr()))

const anchorByIndex = computed(() => {
  const src = chartMode.value === 'intraday' ? intradayMarkAnchors.value : markAnchors.value
  const m = new Map<number, { marks: TradeMark[]; exact: boolean }>()
  for (const a of src) m.set(a.index, { marks: a.marks, exact: a.exact })
  return m
})

const activeMarkNotes = computed<string[]>(() => {
  const i = scrub.activeIndex.value
  if (i == null) return []

  let hit = anchorByIndex.value.get(i)
  if (!hit) {
    // 长区间下点位密集（1年档可达 250 个），要求拖到恰好那一格几乎不可能。
    // 按可视点数给一个容差，落在标记附近即认定选中。
    const total = chartMode.value === 'intraday'
      ? intradayPoints.value.length
      : rangedHistory.value.length
    const tol = Math.max(1, Math.round(total / 40))
    let best = Infinity
    for (const [idx, v] of anchorByIndex.value) {
      const d = Math.abs(idx - i)
      if (d <= tol && d < best) { best = d; hit = v }
    }
  }
  if (!hit) return []

  const notes = describeMarks(hit.marks)
  return hit.exact ? notes : notes.map(n => `${n}（净值未公布，标在最近交易日）`)
})

const scrubbing = computed(() => scrub.activeIndex.value !== null)

function onChartMouseDown(e: MouseEvent): void {
  if (e.button !== 0) return
  if (readoutRows.value.length < 2) return
  const move = (ev: MouseEvent) => scrub.updateFromClientX(ev.clientX)
  const up = () => {
    window.removeEventListener('mousemove', move)
    window.removeEventListener('mouseup', up)
    scrub.reset()
  }
  window.addEventListener('mousemove', move)
  window.addEventListener('mouseup', up)
  scrub.updateFromClientX(e.clientX)
}

let historyZoom = { start: 0, end: 100 }
function onHistoryDataZoom(e: any): void {
  const b = e?.batch?.[0] ?? e
  if (typeof b?.start === 'number' && typeof b?.end === 'number') {
    historyZoom = { start: b.start, end: b.end }
  }
}

watch(chartRange, () => { historyZoom = { start: 0, end: 100 } })

watch(scrubbing, (on) => {
  if (!on) return
  const inst = chartMode.value === 'intraday' ? intradayChartRef.value : historyChartRef.value
  try { inst?.dispatchAction?.({ type: 'hideTip' }) } catch {  }
})

watch([chartMode, () => readoutRows.value.length], () => scrub.reset())

const intradayChartOption = computed(() => {
  const points = intradayPoints.value
  if (points.length < 2) return null
  const times = points.map(p => p.time)
  const values = points.map(p => p.value)
  const cr = changeRate.value
  const style = getComputedStyle(document.documentElement)

  const intradayMarkPoints: any[] = []
  for (const a of intradayMarkAnchors.value) {
    const v = summarizeAnchor(a.marks)
    intradayMarkPoints.push({
      coord: [times[a.index], values[a.index]],
      tradeLabel: v.label,
      symbolSize: v.size,
      itemStyle: { color: v.color },
    })
  }

  const lineColor = style.getPropertyValue('--text-primary').trim() || '#f5f7f8'
  const fillTop = cr > 0 ? 'rgba(239,68,68,0.22)' : cr < 0 ? 'rgba(34,197,94,0.22)' : 'rgba(138,151,160,0.16)'
  const fillBot = cr > 0 ? 'rgba(239,68,68,0)' : cr < 0 ? 'rgba(34,197,94,0)' : 'rgba(138,151,160,0)'
  const base = baselineNav.value
  const axisColor = style.getPropertyValue('--text-muted').trim() || '#8a97a0'
  const splitColor = style.getPropertyValue('--border-default').trim() || 'rgba(210,224,232,0.10)'
  const tooltipBg = style.getPropertyValue('--bg-card').trim() || '#161c21'
  const tooltipText = style.getPropertyValue('--text-primary').trim() || '#f5f7f8'

  const allSame = values.length > 0 && values.every(v => v === values[0])
  let yMin: number | undefined, yMax: number | undefined
  if (allSame && base > 0 && Math.abs(values[0] - base) > 0) {
    const diff = Math.abs(values[0] - base)
    const halfRange = Math.max(diff * 0.8, values[0] * 0.005)
    const center = (values[0] + base) / 2
    yMin = center - halfRange; yMax = center + halfRange
  } else if (allSame && values[0] > 0) {
    const pad = values[0] * 0.01
    yMin = values[0] - pad; yMax = values[0] + pad
  }

  return {
    backgroundColor: 'transparent',
    grid: { left: 46, right: 14, top: 14, bottom: 24 },
    xAxis: {
      type: 'category',
      data: times,
      boundaryGap: false,
      axisLine: { lineStyle: { color: splitColor } },
      axisTick: { show: false },
      axisLabel: {
        color: axisColor,
        fontSize: 10,
        hideOverlap: true,
        margin: 10,
        formatter: (v: string) => String(v).slice(0, 5),
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      min: yMin,
      max: yMax,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: splitColor, type: 'dashed' } },
      axisLabel: { color: axisColor, fontSize: 10, margin: 8, formatter: (v: number) => v.toFixed(3) },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: splitColor,
      textStyle: { color: tooltipText, fontSize: 12 },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        if (!p) return ''

        const row = readoutRows.value[p.dataIndex]
        if (!row) return ''
        return `${row.label}<br/>估值: ${row.nav.toFixed(4)}<br/>涨跌: ${row.change}`
      },
    },
    series: [{
      type: 'line', data: values, smooth: false, symbol: 'none',
      lineStyle: { color: lineColor, width: 2 },
      markPoint: intradayMarkPoints.length > 0 ? {
        symbol: 'circle',
        symbolSize: 18,
        silent: true,
        data: intradayMarkPoints,
        label: {
          show: true,
          formatter: (p: any) => p.data?.tradeLabel ?? '',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
        },
      } : undefined,
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: fillTop }, { offset: 1, color: fillBot }] } },
      markLine: base > 0 ? { silent: true, symbol: 'none', data: [{ yAxis: base, lineStyle: { color: splitColor, type: 'dashed', width: 1 }, label: { show: false } }] } : undefined,
    }],
  }
})

function formatAxisDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return v
  const range = chartRange.value
  return range === 'y1' || range === 'all' ? `${m[1].slice(2)}-${m[2]}` : `${m[2]}-${m[3]}`
}

const chartOption = computed(() => {
  if (rangedHistory.value.length === 0) return null
  const dates = rangedHistory.value.map(d => d.date)
  const values = rangedHistory.value.map(d => d.value)

  const markPointData: any[] = []
  for (const a of markAnchors.value) {
    const v = summarizeAnchor(a.marks)
    markPointData.push({
      coord: [dates[a.index], values[a.index]],
      tradeLabel: v.label,
      symbolSize: v.size,
      itemStyle: {
        color: v.color,
        borderColor: a.exact ? 'transparent' : '#fff',
        borderWidth: a.exact ? 0 : 1.5,
        borderType: 'dashed' as const,
      },
    })
  }

  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  const rose = last > first
  const fell = last < first
  const historyAreaTint = {
    top: rose ? 'rgba(239, 68, 68, 0.22)' : fell ? 'rgba(34, 197, 94, 0.22)' : 'rgba(138, 151, 160, 0.16)',
    bottom: rose ? 'rgba(239, 68, 68, 0)' : fell ? 'rgba(34, 197, 94, 0)' : 'rgba(138, 151, 160, 0)',
  }

  const style = getComputedStyle(document.documentElement)
  const axisColor = style.getPropertyValue('--text-muted').trim() || '#8a97a0'
  const splitColor = style.getPropertyValue('--border-default').trim() || 'rgba(210,224,232,0.10)'
  const tooltipBg = style.getPropertyValue('--bg-card').trim() || '#161c21'
  const tooltipText = style.getPropertyValue('--text-primary').trim() || '#f5f7f8'
  return {
    backgroundColor: 'transparent',
    grid: { left: 46, right: 14, top: 14, bottom: 44 },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: splitColor } },
      axisTick: { show: false },
      axisLabel: {
        color: axisColor,
        fontSize: 10,
        hideOverlap: true,
        margin: 10,
        formatter: (v: string) => formatAxisDate(String(v)),
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      splitNumber: 4,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: splitColor, type: 'dashed' } },
      axisLabel: { color: axisColor, fontSize: 10, margin: 8, formatter: (v: number) => v.toFixed(3) },
    },
    tooltip: {
      trigger: 'axis', backgroundColor: tooltipBg, borderColor: splitColor, textStyle: { color: tooltipText, fontSize: 12 },
      formatter: (params: any) => {
        const p = Array.isArray(params) ? params[0] : params
        if (!p) return ''

        const row = readoutRows.value[p.dataIndex]
        if (!row) return ''
        return `${row.label}<br/>净值: ${row.nav.toFixed(4)}<br/>日涨跌: ${row.change}`
      },
    },

    dataZoom: [{ type: 'inside', start: historyZoom.start, end: historyZoom.end }],
    series: [{
      type: 'line', data: values, smooth: true, symbol: 'none',

      lineStyle: { color: style.getPropertyValue('--text-primary').trim() || '#f5f7f8', width: 2 },
      markPoint: markPointData.length > 0 ? {
        symbol: 'circle',
        symbolSize: 18,
        silent: true,
        data: markPointData,
        label: {
          show: true,
          formatter: (p: any) => p.data?.tradeLabel ?? '',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
        },
      } : undefined,
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: historyAreaTint.top },
            { offset: 1, color: historyAreaTint.bottom },
          ],
        },
      },
    }],
  }
})

const NAV_PAGE = 15
const navShown = ref(NAV_PAGE)

const navVisible = computed(() => navHistory.value.slice(0, navShown.value))
const navHasMore = computed(() => navShown.value < navHistory.value.length)

function loadMoreNav(): void {
  navShown.value = Math.min(navShown.value + 30, navHistory.value.length)
}

watch(fundCode, () => { navShown.value = NAV_PAGE })

const navHistory = computed<{ d: string; v: number; rate: number | null }[]>(() => {
  const nav = historyData.value
  if (nav.length === 0) return []
  const out: { d: string; v: number; rate: number | null }[] = []

  for (let i = nav.length - 1; i >= 0; i--) {
    const cur = nav[i]
    const prev = i > 0 ? nav[i - 1] : null
    const rate = prev && prev.value > 0 ? ((cur.value - prev.value) / prev.value) * 100 : null
    out.push({ d: cur.date, v: cur.value, rate })
  }
  return out
})

function rateTone(v: number | null): string {
  if (v == null) return 'text-flat'
  return v > 0 ? 'text-rise' : v < 0 ? 'text-fall' : 'text-flat'
}

const RISK_FREE_RATE = 1.5
const TRADING_DAYS_PER_YEAR = 242
const RISK_MIN_SAMPLES = 20

const riskMetrics = computed(() => {
  const nav = historyData.value
  if (nav.length < RISK_MIN_SAMPLES + 1) return null

  const rets: number[] = []
  for (let i = 1; i < nav.length; i++) {
    const prev = nav[i - 1].value
    if (prev > 0) rets.push((nav[i].value - prev) / prev)
  }
  if (rets.length < RISK_MIN_SAMPLES) return null

  const mean = rets.reduce((s, r) => s + r, 0) / rets.length
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)
  const dailyStd = Math.sqrt(variance)
  const volatility = dailyStd * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100
  const annualReturn = mean * TRADING_DAYS_PER_YEAR * 100

  let peak = nav[0].value
  let maxDrawdown = 0
  for (const p of nav) {
    if (p.value > peak) peak = p.value
    if (peak > 0) {
      const dd = ((peak - p.value) / peak) * 100
      if (dd > maxDrawdown) maxDrawdown = dd
    }
  }

  const sharpe = volatility > 0 ? (annualReturn - RISK_FREE_RATE) / volatility : 0
  const winRate = (rets.filter(r => r > 0).length / rets.length) * 100
  const worstDay = Math.min(...rets) * 100

  return {
    sampleDays: nav.length,
    volatility,
    annualReturn,
    maxDrawdown,
    sharpe,
    winRate,
    worstDay,
  }
})

const ALLOC_TONE: Record<string, string> = {
  股票: 'stock', 债券: 'bond', 现金: 'cash', 银行存款: 'cash', 基金: 'fof',
}

function allocTone(name: string): string {
  for (const [k, v] of Object.entries(ALLOC_TONE)) {
    if (name.includes(k)) return v
  }
  return 'other'
}

const allocRows = computed(() => {
  const list = fundInfo.value?.assetAllocation ?? []
  return list
    .filter(a => a.ratio > 0)
    .map(a => ({ category: a.category, ratio: a.ratio, tone: allocTone(a.category) }))
    .sort((a, b) => b.ratio - a.ratio)
})

const allocTotal = computed(() => allocRows.value.reduce((s, a) => s + a.ratio, 0))
const allocOther = computed(() => Math.max(100 - allocTotal.value, 0))
const stockPosition = computed(() => {
  const hit = allocRows.value.find(a => a.tone === 'stock')
  return hit ? hit.ratio : null
})

const chartPalette = () => {
  const style = getComputedStyle(document.documentElement)
  return {
    axis: style.getPropertyValue('--text-muted').trim() || '#8a97a0',
    split: style.getPropertyValue('--border-default').trim() || 'rgba(210,224,232,0.10)',
    tipBg: style.getPropertyValue('--bg-card').trim() || '#161c21',
    tipText: style.getPropertyValue('--text-primary').trim() || '#f5f7f8',
    primary: style.getPropertyValue('--color-primary').trim() || '#ff8a3d',
  }
}

const managers = computed(() => fundInfo.value?.managers ?? [])

const managerRadarOptions = computed(() => {
  const c = chartPalette()
  return managers.value.map((m) => {
    if (m.power.length < 3) return null
    return {
      backgroundColor: 'transparent',
      tooltip: {
        backgroundColor: c.tipBg,
        borderColor: c.split,
        textStyle: { color: c.tipText, fontSize: 11 },
      },
      radar: {
        indicator: m.power.map(p => ({ name: p.label, max: 100 })),
        radius: '66%',
        center: ['50%', '54%'],
        axisName: { color: c.axis, fontSize: 10 },
        splitLine: { lineStyle: { color: c.split } },
        axisLine: { lineStyle: { color: c.split } },
        splitArea: { show: false },
      },
      series: [{
        type: 'radar',
        symbolSize: 3,
        data: [{
          value: m.power.map(p => p.value),
          name: m.name,
          lineStyle: { color: c.primary, width: 1.5 },
          itemStyle: { color: c.primary },
          areaStyle: { color: c.primary, opacity: 0.18 },
        }],
      }],
    }
  })
})

const positionTrendOption = computed(() => {
  const pts = fundInfo.value?.positionTrend ?? []
  if (pts.length < 2) return null
  const c = chartPalette()
  return {
    backgroundColor: 'transparent',
    grid: { left: 42, right: 14, top: 16, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: c.tipBg,
      borderColor: c.split,
      textStyle: { color: c.tipText, fontSize: 11 },
      valueFormatter: (v: number) => `${Number(v).toFixed(2)}%`,
    },
    xAxis: {
      type: 'category',
      data: pts.map((p) => {
        const d = new Date(p[0])
        return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }),
      axisLine: { lineStyle: { color: c.split } },
      axisLabel: { color: c.axis, fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: { color: c.axis, fontSize: 10, formatter: '{value}%' },
      splitLine: { lineStyle: { color: c.split } },
    },
    series: [{
      type: 'line',
      data: pts.map(p => p[1]),
      smooth: true,
      showSymbol: false,
      lineStyle: { color: c.primary, width: 1.6 },
      areaStyle: { color: c.primary, opacity: 0.12 },
    }],
  }
})

function periodRows(ps: { categories: string[]; series: { name: string; values: number[] }[] } | null | undefined) {
  if (!ps || ps.series.length === 0) return []
  return ps.categories.map((period, i) => ({
    period,
    items: ps.series
      .map(s => ({ name: s.name, value: s.values[i] }))
      .filter(x => Number.isFinite(x.value)),
  })).filter(r => r.items.length > 0).reverse()
}

const allocHistoryRows = computed(() => {
  const rows = periodRows(fundInfo.value?.assetAllocHistory)
  return rows.map(r => ({
    period: r.period,
    items: r.items
      .filter(x => !x.name.includes('净资产'))
      .map(x => ({ name: x.name.replace(/占净比$/, ''), value: x.value, tone: allocTone(x.name) })),
    netAsset: r.items.find(x => x.name.includes('净资产'))?.value ?? null,
  }))
})

const holderHistoryRows = computed(() => {
  const rows = periodRows(fundInfo.value?.holderHistory)
  return rows.map(r => ({
    period: r.period,
    items: r.items.map(x => ({ name: x.name.replace(/持有比例$/, ''), value: x.value })),
  }))
})

const buySedemptionRows = computed(() => periodRows(fundInfo.value?.buySedemption))

const scaleRows = computed(() => {
  const list = fundInfo.value?.scaleHistory ?? []
  return [...list].reverse().map(s => ({
    period: s.period,
    scale: s.scale,
    mom: s.mom,
    momValue: s.mom ? parseFloat(s.mom.replace('%', '')) : null,
  }))
})

const scaleMax = computed(() => scaleRows.value.reduce((m, s) => Math.max(m, s.scale), 0))

const peerRankLatest = computed(() => {
  const list = fundInfo.value?.peerRankTrend ?? []
  return list.length > 0 ? list[list.length - 1] : null
})

const baseInfo = ref<FundBaseInfo | null>(null)

const detailLoading = ref(false)
const fundInfo = ref<FundInfo | null>(null)

const cachedPerfItems = ref<{ title: string; value: number }[]>([])

const perfItems = computed(() => {
  const fromNet = fundInfo.value?.performanceItems ?? []
  return fromNet.length > 0 ? fromNet : cachedPerfItems.value
})
const fundAllHoldings = ref<FundAllHoldings | null>(null)
const holdingsLoading = ref(false)

const {
  estimated: estimatedHoldings, loadEstimation, refreshFromCache,
  getPrevDayRate, prevDayClass,
  getRealtimeRate, realtimeClass,
  prevDayMap, realtimeMap,
} = useEstimatedHoldings(fundCode, delayDays)

const holdingsMode = stockQuoteMode

function stockChange(stock: HoldingDetailItem): number | null {
  return holdingsMode.value === 'close' ? getPrevDayRate(stock.stockCode) : getRealtimeRate(stock.stockCode)
}
function stockChangeClass(stock: HoldingDetailItem): string {
  return holdingsMode.value === 'close' ? prevDayClass(stock.stockCode) : realtimeClass(stock.stockCode)
}

const expandedStocks = ref<Set<string>>(new Set())
function toggleStock(stockCode: string): void {
  const s = new Set(expandedStocks.value)
  if (s.has(stockCode)) s.delete(stockCode)
  else s.add(stockCode)
  expandedStocks.value = s
}

function stockQuote(stock: HoldingDetailItem): StockQuoteInfo | undefined {
  const map = holdingsMode.value === 'close' ? prevDayMap.value : realtimeMap.value
  return map.get(stock.stockCode)
}

function marketLabel(stock: HoldingDetailItem, q?: StockQuoteInfo): string {
  const em = stock.emMarketCode
  if (em) return EM_MARKET_LABEL[em] || em
  const fromQuote = q?.market
  if (fromQuote && fromQuote !== 'unknown') return SHARE_CLASS_CN[fromQuote] ?? fromQuote
  return '空(待补全)'
}

function rowMarketLabel(stock: HoldingDetailItem): string {
  const em = stock.emMarketCode
  if (em) return EM_MARKET_LABEL[em] || em
  const m = stockQuote(stock)?.market
  return m && m !== 'unknown' ? (SHARE_CLASS_CN[m] ?? m) : ''
}

function shareClass(stock: HoldingDetailItem, q?: StockQuoteInfo): string {  const byEm = classifyShare(stock.emMarketCode, stock.stockCode)
  if (byEm !== 'unknown') return byEm
  return q?.market && q.market !== 'unknown' ? q.market : 'unknown'
}

const SHARE_CLASS_CN: Record<string, string> = {
  A: 'A股', HK: '港股', US: '美股',
  JP: '日股', KR: '韩股', TW: '台股',
  DE: '德股', FR: '法股', UK: '英股',
  unknown: '未识别',
}

const TZ_CN: Record<string, string> = {
  A: '北京', HK: '香港', US: '纽约', JP: '东京', KR: '首尔',
  TW: '台北', DE: '法兰克福', FR: '巴黎', UK: '伦敦',
}

const MARKET_DESC: Record<string, string> = {
  A: 'A股 · 腾讯/东财', HK: '港股 · 腾讯/东财',
  US: '美股 · 盘中腾讯/盘外Yahoo',
  JP: '日股 · Yahoo', KR: '韩股 · Yahoo', TW: '台股 · Yahoo',
  DE: '德股 · Yahoo', FR: '法股 · Yahoo', UK: '英股 · Yahoo',
  unknown: '未识别 · Yahoo 兜底',
}

function contribution(stock: HoldingDetailItem): number | null {
  const rate = stockChange(stock)
  if (rate == null || !(stock.ratio > 0)) return null
  return stock.ratio * rate / 100
}

const stockDetails = computed(() => {
  const out = new Map<string, {
    marketLabel: string; shareClass: string; shareClassRaw: string; source: string; status: string
    statusTone: 'ok' | 'wait' | 'off'; session: string; tz: string
    tradingState: string; updatedAt: string; contribution: number | null
    marketDesc: string; raw: string; noMarket: boolean; viaYahoo: boolean
  }>()
  if (expandedStocks.value.size === 0) return out

  const list = displayHoldings.value?.holdings ?? []
  for (const stock of list) {
    if (!expandedStocks.value.has(stock.stockCode)) continue
    const q = stockQuote(stock)
    const cls = shareClass(stock, q)
    const tz = stockMarketToTz(cls as never)
    let tradingState = '—'
    if (tz !== 'unknown') {
      const td = resolveMarketTradingDays(tz)
      tradingState = td.isNonTradingDay ? '非交易日' : !td.hasOpened ? '未开盘' : td.isClosed ? '已收盘' : '交易中'
    }
    const status = !q ? '未取' : q.closed ? '休盘' : q.changeRate != null ? '已就绪' : '取数中'
    out.set(stock.stockCode, {
      marketLabel: marketLabel(stock, q),
      shareClass: SHARE_CLASS_CN[cls] ?? cls,
      shareClassRaw: cls,
      source: q?.source || '待取',
      status,
      statusTone: status === '已就绪' ? 'ok' : status === '休盘' ? 'off' : 'wait',
      session: q?.session ? ({ PRE: '盘前', REGULAR: '盘中', POST: '盘后' }[q.session] ?? q.session) : '',
      tz: tz === 'unknown' ? '—' : (TZ_CN[tz] ?? tz),
      tradingState,
      updatedAt: q?.updatedAt ? formatValuationTimeWithSeconds(new Date(q.updatedAt).toISOString()) : (q?.date || '—'),
      contribution: contribution(stock),
      marketDesc: MARKET_DESC[cls] ?? MARKET_DESC.unknown,
      raw: stock.rawEntry || stock.stockCode,
      noMarket: !stock.emMarketCode && cls === 'unknown',
      viaYahoo: !!q?.source?.toLowerCase().includes('yahoo'),
    })
  }
  return out
})

watch([fundCode, () => props.isActive], () => {
  if (props.isActive === false) return
  void nextTick(() => {
    const el = detailBodyEl.value
    if (el && detailScrollTop.value > 0) el.scrollTop = detailScrollTop.value
  })
})

const displayHoldings = computed(() => {
  if (estimatedHoldings.value) {
    const e = estimatedHoldings.value

    const tag = e.description.split('，')[0] || '推算持仓'

    const isFull = e.holdings.some(h => h.isEstimated)
    return { reportDate: e.quarterReportDate, reportType: tag, isFull, holdings: e.holdings }
  }

  return fundAllHoldings.value
})

let loadedCode = ''

async function loadData(code: string): Promise<void> {
  const switched = loadedCode !== code
  loadedCode = code
  chartLoading.value = switched
  detailLoading.value = switched
  holdingsLoading.value = switched
  if (switched) {
    historyData.value = []
    fundInfo.value = null
    cachedPerfItems.value = []
    fundAllHoldings.value = null
  }

  const v = fundStore.getValuation(code)
  const isT2val = v?.delayDays === 2 || (v?.delayDays == null && v?.gztime && !v?.gztime?.includes?.(':'))

  void fetchFundBaseInfo(code).then(r => {
    if (fundCode.value === code) baseInfo.value = r
  }).catch(() => {  })

  const intradayTask = (async () => {
    if (isT2val && v) {
      fundStore.updateIntradayPoints(code, v)
      return
    }

    const existing = keepTodayPoints(fundStore.intradayMap[code])
    if (existing.length >= 2) return

    if (!isCnMarketOpenForIntraday()) return
    try {
      const pts = await fetchIntradayEstimate(code)
      if (pts.length > 0) {
        const lastSinaVal = pts[pts.length - 1].value
        const currentGz = v?.gz || 0
        const scale = (lastSinaVal > 0 && currentGz > 0) ? currentGz / lastSinaVal : 1
        const scaled = scale !== 1 ? pts.map(p => ({ ...p, value: p.value * scale })) : pts
        fundStore.intradayMap = { ...fundStore.intradayMap, [code]: scaled }
      }
    } catch {  }
  })()

  // 用 peek 而非 getPerfIntervals：后者带新鲜度判定，缓存落后一个交易日
  // 就返回空，详情页会拿不到净值序列、整张图画不出来（标记自然也没有）。
  // 画图只需要有数据，新鲜度由后续网络覆盖负责。
  const cachedNav = peekNavSeries(code)
  if (cachedNav && cachedNav.length > 0) {
    historyData.value = cachedNav.map(p => ({ date: p.d, value: p.v }))
    chartLoading.value = false
  }
  cachedPerfItems.value = peekPerfItems(code)
  if (cachedPerfItems.value.length === 0) {
    void fetchMissingPerf([code], () => {
      if (fundCode.value === code) cachedPerfItems.value = peekPerfItems(code)
    }).catch(() => {  })
  }

  const fullDataTask = (async () => {
    try {
      const { history, info, pingzhongRaw } = await getFundFullData(code)
      if (fundCode.value !== code) return pingzhongRaw
      // 只在网络这份不比已有的短时才覆盖：取数降级/接口只返回少量点位时
      // 直接覆盖会把缓存里的长序列截掉，历史标记随之落到区间外而消失。
      if (history.length >= historyData.value.length) historyData.value = history
      fundInfo.value = info
      return pingzhongRaw
    } finally {
      if (fundCode.value === code) {
        chartLoading.value = false
        detailLoading.value = false
      }
    }
  })()

  const holdingsTask = (async () => {
    if (fundCode.value !== code) return

    try {
      const pingzhongRaw = await fullDataTask

      if (fundCode.value !== code) return

      if (delayDays.value === 2) {
        fundStore.startStockPreload?.()
        await loadEstimation(pingzhongRaw)
      } else {
        fundStore.startStockPreload?.()
        await loadEstimation(pingzhongRaw)
        refreshFromCache()
        fundStore.startRealtimeEstimate?.()
      }
    } finally {
      if (fundCode.value === code) holdingsLoading.value = false
    }
  })()

  await Promise.all([intradayTask, fullDataTask, holdingsTask])
}

onMounted(() => {
  if (fundCode.value) loadData(fundCode.value)
})

watch(fundCode, (code) => {
  if (code) loadData(code)
})
</script>
<style scoped>
.fund-detail-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dp-topbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  min-height: 72px;
  flex-shrink: 0;
  background: var(--bg-base);
  z-index: 5;
}
.dp-topbar::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: linear-gradient(
    to right,
    transparent,
    var(--border-default) 22%,
    var(--color-primary) 50%,
    var(--border-default) 78%,
    transparent
  );
  opacity: 0;
  transition: opacity var(--transition-normal);
  pointer-events: none;
}
.dp-topbar.is-stuck::after { opacity: 0.75; }
.dp-back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast);
}
.dp-back:hover {
  background: var(--bg-card-hover);
  color: var(--text-primary);
  border-color: var(--border-hover);
}
.dp-back:active { transform: scale(0.94); }
.dp-topident {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
}
.dp-topname {
  font-size: var(--font-md);
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  letter-spacing: 0.01em;
}
.dp-topcode {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.06em;
}
.dp-topspacer { width: 44px; flex-shrink: 0; }

.detail-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 var(--spacing-md) var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 100%;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.detail-body::-webkit-scrollbar { display: none; width: 0; }

.detail-body > * { flex-shrink: 0; }

.dp-hero {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.dp-ident {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-xs);
  color: var(--text-muted);
  flex-wrap: wrap;
}
.dp-ident-type { color: var(--text-secondary); }

.dp-keys {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-xs);
  margin-top: var(--spacing-sm);
}
.dp-key {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  min-width: 0;
  padding: 10px 6px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  text-align: center;
}
.dp-key-k {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.dp-key-v {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 26px;
  max-width: 100%;
  font-size: clamp(17px, 4.4vw, 21px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dp-key-v-text {
  font-size: clamp(14px, 3.6vw, 17px);
  letter-spacing: 0;
}
.dp-key-t {
  max-width: 100%;
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.text-warn { color: var(--color-primary); }
.text-ok { color: var(--text-primary); }

@media (max-width: 640px) {
  .dp-keys { grid-template-columns: repeat(2, 1fr); gap: var(--spacing-xs); }
  .dp-key-v { font-size: clamp(19px, 5.5vw, 24px); }
  .dp-key-v-text { font-size: clamp(15px, 4.2vw, 18px); }
}

@media (max-width: 420px) {
  .dp-key { padding: 9px 4px; }
  .dp-key-k { font-size: 10px; }
  .dp-key-v { min-height: 24px; font-size: clamp(17px, 5.2vw, 21px); }
  .dp-key-v-text { font-size: clamp(13px, 4vw, 16px); }
  .dp-t-year { display: none; }
}

.dp-ranges {
  display: flex;
  gap: 2px;
  margin-top: var(--spacing-md);
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}
.dp-range {
  flex: 1;
  padding: 6px 0;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color var(--duration-fast) var(--ease-out-expo),
              color var(--duration-fast) var(--ease-out-expo);
}
.dp-range:hover:not(.is-on) { color: var(--text-secondary); }

.dp-range.is-on {
  background: var(--text-primary);
  color: var(--bg-base);
}

.chart-box {
  position: relative;
  margin-top: var(--spacing-sm);
  height: 210px;

  touch-action: pan-y;
}
.chart { width: 100%; height: 100%; position: relative; z-index: 0; }
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.chart-empty p { margin: 0; }

.scrub-readout {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  padding: 4px 8px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  font-size: 11px;
  pointer-events: none;
}
.scrub-label { color: var(--text-muted); }
.scrub-nav { color: var(--text-primary); font-weight: 600; }
.scrub-change { font-weight: 600; }

.scrub-trades {
  position: absolute;
  top: 28px;
  left: 0;
  right: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  pointer-events: none;
}
.scrub-trade {
  padding: 3px 9px;
  border-radius: var(--radius-md);
  background: var(--bg-card);
  border: 1px solid var(--color-primary);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-md);
}
.scrub-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  z-index: 2;
  background: var(--color-primary);
  opacity: 0.75;
  pointer-events: none;
}

.dp-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
}
.dp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: var(--spacing-md);
  min-width: 0;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  text-align: center;
}
.dp-stat-label {
  max-width: 100%;
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}
.dp-stat-val {
  max-width: 100%;
  font-size: var(--font-lg);
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dp-stat-sub {
  max-width: 100%;
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dp-nohold {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px dashed var(--border-default);
}
.dp-nohold-text { font-size: var(--font-xs); color: var(--text-muted); text-align: center; }

.dp-tabs {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  overscroll-behavior-x: contain;
  -webkit-overflow-scrolling: touch;
  scroll-snap-type: x proximity;
  scroll-padding-inline: var(--spacing-md);

  margin: 0 calc(-1 * var(--spacing-md));
  padding: var(--spacing-xs) var(--spacing-md);

  position: sticky;
  top: 0;
  z-index: 4;
  background: var(--bg-base);
  -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
  mask-image: linear-gradient(to right, #000 calc(100% - 24px), transparent 100%);
}
.dp-tabs::-webkit-scrollbar { display: none; }
.dp-tab {
  display: flex;
  scroll-snap-align: start;
  align-items: baseline;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-subtle);
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  cursor: pointer;
  transition: background-color var(--duration-fast) var(--ease-out-expo),
              border-color var(--duration-fast) var(--ease-out-expo),
              color var(--duration-fast) var(--ease-out-expo);
}
.dp-tab:hover:not(.is-on) { border-color: var(--border-hover); color: var(--text-secondary); }
.dp-tab.is-on {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.dp-tab-no {
  font-size: 10px;
  font-weight: 700;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.dp-tab.is-on .dp-tab-no { opacity: 1; }
.dp-tab-label { font-size: var(--font-sm); font-weight: 600; }

.dp-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
}
.dp-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.dp-panel-cap {
  margin: 0;
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.dp-risk-note {
  margin: var(--spacing-sm) 0 0;
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--border-subtle);
  font-size: 10px;
  line-height: 1.6;
  color: var(--text-muted);
}
.dp-empty {
  margin: 0;
  padding: var(--spacing-md) 0;
  font-size: var(--font-xs);
  color: var(--text-muted);
  text-align: center;
}

.dp-seg {
  position: relative;
  display: inline-flex;
  padding: 3px;
  border-radius: var(--radius-full);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  isolation: isolate;
}
.dp-seg::before {
  content: '';
  position: absolute;
  z-index: -1;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
  transition: transform var(--duration-base, 260ms) var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1));
}
.dp-seg[data-on='realtime']::before { transform: translateX(100%); }
.dp-seg[data-on='realtime']::before { background: color-mix(in srgb, var(--color-primary) 22%, var(--bg-elevated)); }
.dp-seg-btn {
  position: relative;
  min-width: 62px;
  padding: 5px 13px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--transition-fast);
}
.dp-seg-btn:hover:not(.is-on) { color: var(--text-secondary); }
.dp-seg-btn.is-on { color: var(--text-primary); }
.dp-seg-btn.is-on .seg-dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-right: 4px;
  border-radius: 50%;
  background: var(--color-primary);
  vertical-align: middle;
  animation: seg-pulse 1.8s ease-in-out infinite;
}
.dp-seg-btn .seg-dot { display: none; }
@keyframes seg-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.82); }
}

.dp-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  padding-bottom: calc(var(--spacing-sm) + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}
.dp-act {
  flex: 1;
  padding: 11px var(--spacing-sm);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.dp-act:hover { background: var(--bg-card-hover); border-color: var(--border-hover); color: var(--text-primary); }

.dp-act-primary {
  background: var(--color-primary);
  border-color: transparent;
  color: var(--color-on-primary);
}
.dp-act-primary:hover { background: var(--color-primary-light); color: var(--color-on-primary); }
.dp-act-wide { flex: 1; }

.dp-act-icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  padding: 11px 0;
  color: var(--text-muted);
}
.dp-act-danger:hover { background: var(--color-rise-glow); border-color: var(--color-rise); color: var(--color-rise); }

.dp-act-remove { color: var(--color-rise); opacity: 0.75; }
.dp-act-remove:hover {
  opacity: 1;
  background: var(--color-rise-glow);
  border-color: var(--color-rise);
  color: var(--color-rise);
}

.dp-form { display: flex; flex-direction: column; gap: var(--spacing-md); }
.dp-field { display: flex; flex-direction: column; gap: 5px; }
.dp-label { font-size: var(--font-xs); color: var(--text-muted); font-weight: 500; }
.dp-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 var(--spacing-sm);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.dp-input-wrap:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-glow);
}
.dp-unit { font-size: var(--font-sm); color: var(--text-muted); flex-shrink: 0; }
.dp-unit-suffix { margin-left: auto; }
.dp-input {
  flex: 1;
  min-width: 0;
  padding: 10px 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-md);
  font-variant-numeric: tabular-nums;
  outline: none;
}

.dp-input::-webkit-outer-spin-button,
.dp-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.dp-input[type=number] { -moz-appearance: textfield; }
.dp-hint { margin: 0; font-size: var(--font-xs); color: var(--text-muted); }

.dp-fbtn {
  flex: 1;
  padding: 11px var(--spacing-md);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-sm);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.dp-fbtn:hover { background: var(--bg-card-hover); color: var(--text-primary); }
.dp-fbtn-primary {
  border-color: transparent;
  background: var(--color-primary);
  color: var(--color-on-primary);
}
.dp-fbtn-primary:hover { background: var(--color-primary-light); color: var(--color-on-primary); }

.perf-row { display: flex; gap: 6px; flex-wrap: wrap; }

.perf-item {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  flex: 1 1 62px;
  padding: 8px 10px; border-radius: var(--radius-md); min-width: 62px;
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}
.perf-val { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.perf-rise .perf-val { color: var(--color-rise); }
.perf-fall .perf-val { color: var(--color-fall); }
.perf-flat .perf-val { color: var(--text-secondary); }
.perf-label { font-size: 10px; color: var(--text-muted); }

.alloc-section { display: flex; flex-direction: column; gap: 8px; margin-top: var(--spacing-xs); }
.alloc-item { display: flex; flex-direction: column; gap: 4px; }
.alloc-bar-row { display: flex; justify-content: space-between; align-items: center; }
.alloc-label { font-size: 11px; color: var(--text-muted); }
.alloc-val { font-size: 11px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.alloc-bar-bg { height: 5px; background: var(--bg-surface); border-radius: var(--radius-full); overflow: hidden; }
.alloc-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-out-expo);
}

.dp-navlist {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: var(--spacing-xs);
}
.navlist-head,
.navlist-row {
  display: grid;
  grid-template-columns: 1fr 84px 72px;
  gap: var(--spacing-sm);
  align-items: center;
}
.navlist-head {
  padding: 5px var(--spacing-sm);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.navlist-head > :nth-child(2),
.navlist-head > :nth-child(3) { text-align: right; }

.navlist-body { display: flex; flex-direction: column; }

.navlist-more {
  margin-top: var(--spacing-sm);
  padding: 8px 0;
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  font-family: inherit;
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast);
}
.navlist-more:hover {
  background: var(--color-primary-glow);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.navlist-row {
  padding: 6px var(--spacing-sm);
  border-bottom: 1px solid var(--border-subtle);
  font-size: 12px;
}
.navlist-row:last-child { border-bottom: none; }
.nl-date { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.nl-val {
  text-align: right;
  color: var(--text-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.nl-rate {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}
.info-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 9px 11px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  min-width: 0;
}
.info-label { font-size: 10px; color: var(--text-muted); }
.info-val {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.holdings-table {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.holdings-thead {
  display: grid;
  grid-template-columns: 20px 1fr 48px 60px;
  padding: 6px 10px;
  background: var(--bg-surface);
  font-size: 10px;
  color: var(--text-muted);
  gap: 8px;
  align-items: center;
}
.holdings-thead span:nth-child(3),
.holdings-thead span:nth-child(4) { text-align: right; }
.holdings-row {
  display: grid;
  grid-template-columns: 20px 1fr 48px 60px;
  padding: 7px 10px;
  gap: 8px;
  align-items: center;
  border-top: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.holdings-row:hover { background: var(--bg-card-hover); }
.h-idx { font-size: 11px; color: var(--text-muted); font-variant-numeric: tabular-nums; }
.h-name-wrap { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.h-name { font-size: 12px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.h-code { font-size: 10px; color: var(--text-muted); }
.h-ratio { font-size: 12px; color: var(--text-secondary); text-align: right; font-variant-numeric: tabular-nums; }
.h-rate { font-size: 12px; text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }

.hx-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-xs);
  padding: 9px 4px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}
.hx-sum-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
.hx-sum-k { font-size: 10px; color: var(--text-muted); white-space: nowrap; }
.hx-sum-v {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.hx-partial {
  margin-left: 1px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: help;
}

.hx-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hx-item {
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  overflow: hidden;
  transition: border-color var(--transition-fast);
}
.hx-item.is-open { border-color: var(--border-hover); }

.hx-main {
  position: relative;
  display: grid;
  grid-template-columns: 22px 1fr auto auto 14px;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  background: transparent;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}
.hx-main.is-static { cursor: default; }
.hx-main:hover:not(.is-static) { background: var(--bg-card-hover); }

.hx-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--color-primary);
  opacity: 0.09;
  pointer-events: none;
  transition: width var(--transition-base);
}
.hx-main > :not(.hx-bar) { position: relative; z-index: 1; }

.hx-rank {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.hx-ident { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.hx-name {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hx-meta { display: flex; align-items: center; gap: 5px; min-width: 0; }
.hx-code { font-size: 10px; color: var(--text-muted); }
.hx-mkt {
  padding: 0 4px;
  border-radius: 3px;
  background: var(--bg-elevated);
  font-size: 9px;
  color: var(--text-muted);
  white-space: nowrap;
}

.hx-ratio { display: flex; align-items: baseline; gap: 1px; justify-content: flex-end; }
.hx-ratio-v {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.hx-ratio-u { font-size: 9px; color: var(--text-muted); }

.hx-chg {
  min-width: 62px;
  text-align: right;
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.hx-arrow {
  color: var(--text-muted);
  transition: transform var(--transition-fast);
}
.hx-item.is-open .hx-arrow { transform: rotate(180deg); }

.hx-detail {
  display: grid;
  grid-template-rows: 1fr;
  background: var(--bg-base);
}
.hx-detail > .hx-detail-clip {
  min-height: 0;
  overflow: hidden;
}
.hx-detail-inner {
  padding: 8px 10px 10px 40px;
  border-top: 1px solid var(--border-subtle);
}
.hx-tags { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.hx-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--bg-elevated);
  font-size: 10px;
  max-width: 100%;
}
.hx-tag em { color: var(--text-muted); font-style: normal; flex-shrink: 0; }
.hx-tag b {
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.hx-tag.is-warn { background: color-mix(in srgb, var(--color-fall) 14%, transparent); }
.hx-tag.is-warn b { color: var(--color-fall); }
.hx-tag[data-tone='ok'] b { color: var(--color-rise); }
.hx-tag[data-tone='wait'] b { color: var(--color-primary); }

.hx-kpis {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  margin-bottom: 8px;
}
.hx-kpi {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 7px 9px;
  border-radius: var(--radius-md);
  background: var(--bg-elevated);
}
.hx-kpi em {
  font-style: normal;
  font-size: 10px;
  color: var(--text-muted);
}
.hx-kpi b {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.hx-rows { margin: 8px 0 0; display: flex; flex-direction: column; gap: 5px; }
.hx-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
  min-width: 0;
}
.hx-row dt { color: var(--text-muted); flex-shrink: 0; }
.hx-row dd {
  margin: 0;
  color: var(--text-secondary);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.hx-row-sub { color: var(--text-muted); }

.collapse-enter-active,
.collapse-leave-active {
  transition: grid-template-rows var(--duration-fast) var(--ease-out-expo),
              opacity var(--duration-fast) var(--ease-out-expo);
}
.collapse-enter-from,
.collapse-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}
.collapse-enter-active .hx-detail-inner > * {
  animation: hx-detail-in var(--duration-fast) var(--ease-out-expo) forwards;
}
.collapse-enter-active .hx-kpis { animation-delay: 20ms; }
.collapse-enter-active .hx-tags { animation-delay: 50ms; }
.collapse-enter-active .hx-rows { animation-delay: 80ms; }
@keyframes hx-detail-in {
  from { opacity: 0; transform: translate3d(0, -4px, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
.collapse-leave-active .hx-detail-inner > * { animation: none; }

@media (prefers-reduced-motion: reduce) {
  .collapse-enter-active,
  .collapse-leave-active { transition-duration: 1ms; }
  .collapse-enter-active .hx-detail-inner > * { animation: none; }
}

.ac-stack {
  display: flex;
  height: 10px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--bg-elevated);
  margin-bottom: 12px;
}
.ac-stack i { display: block; height: 100%; transition: width var(--duration-fast) var(--ease-out-expo); }
.ac-stack i[data-c='stock'] { background: var(--color-primary); }
.ac-stack i[data-c='bond'] { background: #06b6d4; }
.ac-stack i[data-c='cash'] { background: #22c55e; }
.ac-stack i[data-c='fof'] { background: #8b5cf6; }
.ac-stack i[data-c='other'] { background: var(--text-muted); opacity: 0.5; }

.ac-list { display: flex; flex-direction: column; gap: 8px; }
.ac-item {
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) 76px auto;
  align-items: center;
  gap: 8px;
  font-size: var(--font-xs);
}
.ac-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
.ac-dot[data-c='stock'] { background: var(--color-primary); }
.ac-dot[data-c='bond'] { background: #06b6d4; }
.ac-dot[data-c='cash'] { background: #22c55e; }
.ac-dot[data-c='fof'] { background: #8b5cf6; }
.ac-dot[data-c='other'] { background: var(--text-muted); }
.ac-name { color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ac-bar { height: 5px; border-radius: var(--radius-full); background: var(--bg-elevated); overflow: hidden; }
.ac-bar i { display: block; height: 100%; background: var(--color-primary); opacity: 0.85; }
.ac-bar i[data-c='bond'] { background: #06b6d4; }
.ac-bar i[data-c='cash'] { background: #22c55e; }
.ac-bar i[data-c='fof'] { background: #8b5cf6; }
.ac-bar i[data-c='other'] { background: var(--text-muted); }
.ac-val {
  color: var(--text-primary); font-weight: 600;
  font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap;
}

.ac-sum {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  margin-top: 14px;
  background: var(--border-subtle);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.ac-sum-cell {
  display: flex; flex-direction: column; gap: 3px;
  padding: 9px 11px; background: var(--bg-card); min-width: 0;
}
.ac-sum-cell em { font-style: normal; font-size: 10px; color: var(--text-muted); }
.ac-sum-cell b {
  font-size: var(--font-sm); font-weight: 700; color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.ac-note {
  margin: 10px 0 0;
  padding-left: 9px;
  border-left: 2px solid var(--border-subtle);
  font-size: 11px; line-height: 1.65; color: var(--text-muted);
}

.mg-wrap { display: flex; flex-direction: column; gap: 8px; margin-top: var(--spacing-md); }
.mg-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 11px 12px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
}
.mg-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.mg-name { font-size: var(--font-sm); font-weight: 700; color: var(--text-primary); }
.mg-star { display: inline-flex; gap: 1px; }
.mg-star-i { font-size: 10px; color: var(--border-default); font-style: normal; }
.mg-star-i.is-on { color: var(--color-accent, var(--color-primary)); }
.mg-avg {
  margin-left: auto;
  font-size: 10px;
  padding: 2px 7px;
  border-radius: var(--radius-full);
  background: var(--color-primary-glow);
  color: var(--color-primary);
  font-weight: 700;
}
.mg-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: var(--text-muted); }
.mg-radar { height: 190px; }
.mg-radar-c { width: 100%; height: 100%; }
.mg-bars { display: flex; flex-direction: column; gap: 6px; }
.mg-profit {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}
.mg-profit-cell { display: flex; flex-direction: column; gap: 2px; }
.mg-profit-cell em { font-style: normal; font-size: 10px; color: var(--text-muted); }
.mg-profit-cell b { font-size: 12px; font-weight: 700; }

.pt-wrap { margin-top: var(--spacing-md); }
.pt-chart { width: 100%; height: 168px; }

.ph-wrap { display: flex; flex-direction: column; gap: 10px; margin-top: var(--spacing-md); }
.ph-row { display: flex; flex-direction: column; gap: 5px; }
.ph-head { display: flex; align-items: baseline; gap: 8px; }
.ph-period { font-size: 11px; color: var(--text-secondary); font-weight: 600; }
.ph-net { margin-left: auto; font-size: 10px; color: var(--text-muted); }
.ph-stack {
  display: flex;
  height: 7px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--bg-elevated);
}
.ph-stack i { display: block; height: 100%; background: var(--text-muted); }
.ph-stack i[data-c='stock'] { background: var(--color-primary); }
.ph-stack i[data-c='bond'] { background: #06b6d4; }
.ph-stack i[data-c='cash'] { background: #22c55e; }
.ph-stack i[data-c='fof'] { background: #8b5cf6; }
.ph-stack i[data-c='other'] { background: var(--text-muted); opacity: 0.5; }
.ph-stack i[data-h='0'] { background: var(--color-primary); }
.ph-stack i[data-h='1'] { background: #06b6d4; }
.ph-stack i[data-h='2'] { background: #8b5cf6; }
.ph-legend { display: flex; gap: 10px; flex-wrap: wrap; font-size: 10px; color: var(--text-muted); }
.ph-leg { display: inline-flex; align-items: center; gap: 4px; }
.ph-leg i { width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
.ph-leg i[data-c='stock'] { background: var(--color-primary); }
.ph-leg i[data-c='bond'] { background: #06b6d4; }
.ph-leg i[data-c='cash'] { background: #22c55e; }
.ph-leg i[data-c='fof'] { background: #8b5cf6; }
.ph-leg i[data-h='0'] { background: var(--color-primary); }
.ph-leg i[data-h='1'] { background: #06b6d4; }
.ph-leg i[data-h='2'] { background: #8b5cf6; }
.ph-leg b { color: var(--text-secondary); font-weight: 600; }

.sc-wrap { display: flex; flex-direction: column; gap: 7px; margin-top: var(--spacing-md); }
.sc-row {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr) 56px 62px;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}
.sc-period { color: var(--text-muted); }
.sc-bar { height: 6px; border-radius: var(--radius-full); background: var(--bg-elevated); overflow: hidden; }
.sc-bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
  border-radius: var(--radius-full);
  transition: width var(--duration-normal) var(--ease-out-expo);
}
.sc-val { color: var(--text-secondary); text-align: right; font-weight: 600; }
.sc-mom { text-align: right; font-size: 10px; }

.bs-wrap { margin-top: var(--spacing-md); }
.bs-table { display: flex; flex-direction: column; gap: 4px; }
.bs-head, .bs-row {
  display: grid;
  grid-template-columns: 74px repeat(3, minmax(0, 1fr));
  gap: 6px;
  align-items: center;
  font-size: 11px;
}
.bs-head { color: var(--text-muted); font-size: 10px; padding-bottom: 4px; border-bottom: 1px solid var(--border-subtle); }
.bs-head span:not(:first-child), .bs-row span:not(:first-child) { text-align: right; }
.bs-row { color: var(--text-secondary); padding: 3px 0; }
.bs-row span:first-child { color: var(--text-muted); }

@media (max-width: 767px) {
  .mg-radar { height: 168px; }
  .sc-row { grid-template-columns: 62px minmax(0, 1fr) 48px 54px; gap: 6px; }
  .bs-head, .bs-row { grid-template-columns: 62px repeat(3, minmax(0, 1fr)); gap: 4px; font-size: 10px; }
  .ac-item { grid-template-columns: 8px minmax(0, 1fr) 48px auto; gap: 6px; }
  .ac-sum-cell { padding: 7px 9px; }
  .detail-body { padding: 0 var(--spacing-sm) var(--spacing-sm); gap: var(--spacing-sm); }
  .dp-tabs { margin: 0 calc(-1 * var(--spacing-sm)); padding: 0 var(--spacing-sm); }
  .dp-tab { padding: 7px 11px; gap: 5px; }
  .dp-topbar { padding: var(--spacing-sm) var(--spacing-sm); min-height: 66px; }
  .chart-box { height: 180px; }
  .dp-panel { padding: var(--spacing-sm); }
  .hx-main { grid-template-columns: 20px 1fr auto auto 12px; gap: 6px; padding: 8px; }
  .hx-chg { min-width: 56px; font-size: 12px; }
  .hx-name { font-size: 12px; }
  .hx-detail-inner { padding-left: 34px; }
  .hx-kpi { padding: 6px 7px; }
  .hx-kpi b { font-size: 12px; }
  .hx-kpi em { font-size: 9px; }
  .hx-row { font-size: 10px; }
}

@media (max-height: 720px) {
  .chart-box { height: 156px; }
  .dp-key { padding: 8px 5px; }
}

@media (min-width: 1024px) {
  .dp-stats { grid-template-columns: repeat(4, 1fr); }
  .chart-box { height: 260px; }
}

</style>
