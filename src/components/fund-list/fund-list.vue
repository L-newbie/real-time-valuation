<template>
  <div class="fund-list-container">
    <FundToolbar
      :view-mode="viewMode"
      :sort-field="sortField"
      :sort-direction="sortDirection"
      :sort-fields="sortFieldsView"
      @change-view-mode="setViewMode"
      @change-sort-field="handleSortCommand"
      @open-manage="goManage"
    />
    <div
      class="list-body"
      :class="[
        axisLock === 'x' ? 'lock-x' : axisLock === 'y' ? 'lock-y' : '',
        viewMode === 'table' ? 'body-table' : '',
      ]"
      ref="listBodyEl"
      @scroll.passive="onListScroll"
      @touchstart.passive="onListTouchStart"
      @touchmove.passive="onListTouchMove"
      @touchend="onListTouchEnd"
      @touchcancel="onListTouchEnd"
    >
      <div
        v-if="viewMode === 'table'"
        class="table-view animate-fade-in"
        :class="{ 'is-scrolling': isScrolling }"
        ref="tableScrollEl"
        @scroll.passive="onListScroll"
      >
        <div
          class="table-scroll"
          :style="dataColWidth > 0 ? { '--data-col-w': dataColWidth + 'px' } : undefined"
        >
          <table class="fund-table">
            <thead>
              <tr>
                <th class="col-ctrl sticky-col-header">
                  <span class="ctrl-header-label">基金</span>
                </th>
                <th class="col-todayProfit" @click="sortByStoreField('todayProfit')">
                  <span class="th-sortable" :class="{ on: !perfSort && sortField === 'todayProfit' }">
                    今日收益
                    <i v-if="!perfSort && sortField === 'todayProfit'" class="th-arrow" :class="{ asc: sortDirection === 'asc' }" />
                  </span>
                </th>
                <th class="col-totalProfit" @click="sortByStoreField('totalProfit')">
                  <span class="th-sortable" :class="{ on: !perfSort && sortField === 'totalProfit' }">
                    累计收益
                    <i v-if="!perfSort && sortField === 'totalProfit'" class="th-arrow" :class="{ asc: sortDirection === 'asc' }" />
                  </span>
                </th>
                <th class="col-lastNetValue" @click="sortByStoreField('lastNetValue')">
                  <span class="th-sortable" :class="{ on: !perfSort && sortField === 'lastNetValue' }">
                    昨日净值
                    <i v-if="!perfSort && sortField === 'lastNetValue'" class="th-arrow" :class="{ asc: sortDirection === 'asc' }" />
                  </span>
                </th>
                <th
                  v-for="col in PERF_COLUMNS"
                  :key="col.key"
                  class="col-perf"
                  @click="sortByPerf(col.key)"
                >
                  <span class="th-sortable" :class="{ on: perfSort?.key === col.key }">
                    {{ col.label }}
                    <i v-if="perfSort?.key === col.key" class="th-arrow" :class="{ asc: perfSort.dir === 'asc' }" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rowIndex) in displayRows"
                :key="row.fundCode"
                :data-fund-row="row.fundCode"
                class="fund-row animate-stagger"
                :style="{ '--i': staggerIndex(rowIndex) }"
                :class="{ 'longpress-active': popup.visible && popup.fundCode === row.fundCode }"
                @click="handleRowClick(row.fundCode)"
                @touchstart.passive="onTouchStart($event, row.fundCode)"
                @touchmove.passive="onTouchMove($event)"
                @touchend="onTouchEnd($event)"
                @mousedown="onMouseDown($event, row.fundCode)"
                @mousemove="onMouseMove($event)"
                @mouseup="onMouseUp()"
                @mouseleave="cancelLongPress()"
                @contextmenu.prevent="onContextMenu"
              >
                <td class="col-ctrl fund-ctrl-cell sticky-col">
                  <div class="ctrl-stack">
                    <span class="ctrl-name">{{ truncateName(row.fundName) }}</span>
                    <div class="ctrl-holding-row">
                      <span v-if="row.holdingAmount > 0" :class="['ctrl-holding', !p.holding && 'privacy-blur']">
                        ¥{{ formatCompactMoney(row.holdingAmount) }}
                      </span>
                      <span v-else class="ctrl-holding text-muted">--</span>
                      <span v-if="pendingBadge(row.fundCode)" class="ctrl-pending-badge" :class="pendingBadge(row.fundCode)!.cls">{{ pendingBadge(row.fundCode)!.text }}</span>
                      <span class="ctrl-date">{{ formatDate(row.valuationTime) }}</span>
                    </div>
                    <div v-if="row.isUpdated || (row.realtimeGszzl != null && isRealtimeBadgeVisible(row.realtimeSource, row.hasHoldingsRatio))" class="ctrl-status-row">
                      <span v-if="row.realtimeGszzl != null && isRealtimeBadgeVisible(row.realtimeSource, row.hasHoldingsRatio)" :class="['ctrl-realtime', row.realtimeGszzl > 0 ? 'rt-rise' : row.realtimeGszzl < 0 ? 'rt-fall' : 'rt-flat', row.realtimePlaceholder && 'rt-placeholder']">
                        <span class="rt-dot"></span>
                        <span class="rt-value">{{ row.realtimeGszzl > 0 ? '+' : '' }}{{ row.realtimeGszzl.toFixed(2) }}%</span>
                        <span class="rt-label">{{ row.realtimeSource || '实时' }}</span>
                      </span>
                      <span v-if="row.isUpdated" class="ctrl-updated">更新</span>
                    </div>
                  </div>
                </td>
                <td class="col-todayProfit">
                  <template v-if="row.holdingAmount > 0">
                    <div class="dual-row">
                      <span :class="['dual-main font-number', row.todayProfit > 0 ? 'text-rise' : row.todayProfit < 0 ? 'text-fall' : 'text-flat', !p.todayProfit && 'privacy-blur']">
                        {{ formatProfitCompact(row.todayProfit) }}
                      </span>
                      <span v-if="row.hasTodayData" :class="['dual-sub font-number', row.changeRate > 0 ? 'text-rise' : row.changeRate < 0 ? 'text-fall' : 'text-flat', !p.todayRate && 'privacy-blur']">
                        {{ row.changeRate > 0 ? '+' : '' }}{{ row.changeRate.toFixed(2) }}%
                      </span>
                      <span v-else class="dual-sub font-number text-muted">--</span>
                    </div>
                  </template>
                  <div v-else class="dual-row">
                    <span class="dual-main font-number text-muted">--</span>
                    <span v-if="row.hasTodayData" :class="['dual-sub font-number', row.changeRate > 0 ? 'text-rise' : row.changeRate < 0 ? 'text-fall' : 'text-flat', !p.todayRate && 'privacy-blur']">
                      {{ row.changeRate > 0 ? '+' : '' }}{{ row.changeRate.toFixed(2) }}%
                    </span>
                    <span v-else class="dual-sub font-number text-muted">--</span>
                  </div>
                </td>
                <td class="col-totalProfit">
                  <template v-if="row.holdingAmount > 0">
                    <div class="dual-row">
                      <span :class="['dual-main font-number', row.totalProfit > 0 ? 'text-rise' : row.totalProfit < 0 ? 'text-fall' : 'text-flat', !p.totalProfit && 'privacy-blur']">
                        {{ formatProfitCompact(row.totalProfit) }}
                      </span>
                      <span v-if="row.totalReturnRate != null" :class="['dual-sub font-number', row.totalReturnRate > 0 ? 'text-rise' : row.totalReturnRate < 0 ? 'text-fall' : 'text-flat', !p.totalRate && 'privacy-blur']">
                        {{ row.totalReturnRate > 0 ? '+' : '' }}{{ row.totalReturnRate.toFixed(2) }}%
                      </span>
                    </div>
                  </template>
                  <div v-else class="dual-row">
                    <span class="dual-main font-number text-muted">--</span>
                    <span class="dual-sub font-number text-muted">--</span>
                  </div>
                </td>
                <td class="col-lastNetValue">
                  <div class="dual-row">
                    <span class="dual-main font-number">{{ row.lastNetValue > 0 ? row.lastNetValue.toFixed(4) : '--' }}</span>
                    <span v-if="row.lastNetChangeRate != null" :class="['dual-sub font-number', row.lastNetChangeRate > 0 ? 'text-rise' : row.lastNetChangeRate < 0 ? 'text-fall' : 'text-flat']">
                      {{ row.lastNetChangeRate > 0 ? '+' : '' }}{{ row.lastNetChangeRate.toFixed(2) }}%
                    </span>
                    <span v-else class="dual-sub font-number text-muted">--</span>
                  </div>
                </td>
                <td v-for="col in PERF_COLUMNS" :key="col.key" class="col-perf">
                  <span
                    v-if="perfValue(row.fundCode, col.key) != null"
                    :class="['perf-cell font-number', rateClass(perfValue(row.fundCode, col.key)!)]"
                  >
                    {{ perfValue(row.fundCode, col.key)! > 0 ? '+' : '' }}{{ perfValue(row.fundCode, col.key)!.toFixed(2) }}%
                  </span>
                  <span v-else class="perf-cell font-number text-muted">--</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-if="viewMode === 'card'" class="card-view" :class="{ 'has-side-fan': sectionMode === 'pane' && displayRows.length > 1 }">
        <FanSelector
          v-if="displayRows.length > 1 && sectionMode === 'collapse'"
          v-model="activeCardCode"
          :items="fanItems"
          :preview-offset="fanPreview"
          @drag="onFanDrag"
          @activate="goDetail"
        />
        <article
          v-for="row in cardRows"
          :key="row.fundCode"
          :data-fund-row="row.fundCode"
          class="fund-card"
          :class="{
            'longpress-active': popup.visible && popup.fundCode === row.fundCode,
            'is-dragging': cardDragging,
          }"
          :style="cardDragStyle"
          @touchstart.passive="onCardTouchStart($event, row.fundCode)"
          @touchmove.passive="onCardTouchMove($event)"
          @touchend="onCardTouchEnd($event)"
          @mousedown="onMouseDown($event, row.fundCode)"
          @mousemove="onMouseMove($event)"
          @mouseup="onMouseUp()"
          @mouseleave="cancelLongPress()"
          @contextmenu.prevent="onContextMenu"
        >
          <span
            :key="revealKey"
            class="fc-reveal"
            aria-hidden="true"
            :style="{ '--reveal-h': String(revealHue) }"
          />
          <header class="fc-head" @click="handleCardClick(row.fundCode)">
            <div class="fc-mark mark-chip" :style="markStyle(row.fundCode)">
              {{ (row.fundName || row.fundCode).trim().charAt(0) }}
            </div>
            <div class="fc-ident">
              <div class="fc-name-row">
                <span class="fc-name" :title="row.fundName">{{ row.fundName }}</span>
                <span v-if="!row.isEstimated" class="fc-confirmed" title="已确认净值">✓</span>
              </div>
              <div class="fc-meta">
                <span class="fc-code">{{ row.fundCode }}</span>
                <span class="fc-time">{{ formatDate(row.valuationTime) }}</span>
                <span v-if="pendingBadge(row.fundCode)" class="fc-badge" :class="pendingBadge(row.fundCode)!.cls">
                  {{ pendingBadge(row.fundCode)!.text }}
                </span>
                <span v-if="row.isUpdated" class="fc-badge fc-badge-updated">更新</span>
              </div>
            </div>
            <div class="fc-rate is-labeled">
              <div class="fc-rate-item">
                <span class="fc-rate-label">今日涨跌</span>
                <span :class="['fc-rate-val font-number', row.hasTodayData ? rateClass(row.changeRate) : 'text-flat', !p.todayRate && 'privacy-blur']">
                  <template v-if="row.hasTodayData">{{ row.changeRate > 0 ? '+' : '' }}{{ row.changeRate.toFixed(2) }}%</template>
                  <template v-else>--</template>
                </span>
              </div>
              <div
                v-if="row.realtimeGszzl != null && isRealtimeBadgeVisible(row.realtimeSource, row.hasHoldingsRatio)"
                class="fc-rate-item"
              >
                <span class="fc-rate-label">{{ row.realtimeSource || '实时' }}涨跌</span>
                <span
                  :class="['fc-rt', row.realtimeGszzl > 0 ? 'rt-rise' : row.realtimeGszzl < 0 ? 'rt-fall' : 'rt-flat', row.realtimePlaceholder && 'rt-placeholder']"
                >
                  <span class="rt-dot" />
                  <span class="rt-value">{{ row.realtimeGszzl > 0 ? '+' : '' }}{{ row.realtimeGszzl.toFixed(2) }}%</span>
                </span>
              </div>
            </div>
          </header>
          <div class="fc-body" :class="sectionMode === 'pane' ? 'is-split' : 'is-stack'">
            <nav v-if="sectionMode === 'pane'" class="fc-rail" aria-label="卡片内容切换">
              <button
                v-for="tab in CARD_TABS"
                :key="tab.key"
                type="button"
                class="fc-rail-btn"
                :class="{ on: activeTab(row.fundCode) === tab.key }"
                :aria-pressed="activeTab(row.fundCode) === tab.key"
                @click.stop="setActiveTab(row.fundCode, tab.key)"
              >
                <span class="fc-rail-label">{{ tab.label }}</span>
                <span class="fc-rail-sum">{{ tabSummary(row, tab.key) }}</span>
              </button>
            </nav>
            <div class="fc-panes">
          <CardSection
            :mode="sectionMode"
            title="持仓与收益"
            :open="isBlockOpen(row.fundCode, 'holding')"
            :active="isSectionActive(row.fundCode, 'holding')"
            :summary="holdingSummary(row)"
            @update:open="setBlock(row.fundCode, 'holding', $event)"
          >
            <div class="fc-grid">
              <div class="fc-cell">
                <span class="fc-cell-label">持仓金额</span>
                <span :class="['fc-cell-val font-number', row.holdingAmount > 0 ? '' : 'text-muted', row.holdingAmount > 0 && !p.holding ? 'privacy-blur' : '']">
                  {{ row.holdingAmount > 0 ? '¥' + formatCompactMoney(row.holdingAmount) : '--' }}
                </span>
              </div>
              <div class="fc-cell">
                <span class="fc-cell-label">今日收益</span>
                <span v-if="row.holdingAmount > 0" :class="['fc-cell-val font-number', rateClass(row.todayProfit), !p.todayProfit && 'privacy-blur']">
                  {{ formatProfitCompact(row.todayProfit) }}
                </span>
                <span v-else class="fc-cell-val font-number text-muted">--</span>
              </div>
              <div class="fc-cell">
                <span class="fc-cell-label">累计收益</span>
                <span v-if="row.holdingAmount > 0" :class="['fc-cell-val font-number', rateClass(row.totalProfit), !p.totalProfit && 'privacy-blur']">
                  {{ formatProfitCompact(row.totalProfit) }}
                </span>
                <span v-else class="fc-cell-val font-number text-muted">--</span>
              </div>
              <div class="fc-cell">
                <span class="fc-cell-label">收益率</span>
                <span v-if="row.holdingAmount > 0 && row.totalReturnRate != null" :class="['fc-cell-val font-number', rateClass(row.totalReturnRate), !p.totalRate && 'privacy-blur']">
                  {{ row.totalReturnRate > 0 ? '+' : '' }}{{ row.totalReturnRate.toFixed(2) }}%
                </span>
                <span v-else class="fc-cell-val font-number text-muted">--</span>
              </div>
            </div>
            <div v-if="sectionMode === 'pane'" class="fc-ops">
              <template v-if="row.holdingAmount > 0">
                <button type="button" class="fc-op" @click.stop="openOp(row.fundCode, 'add')">加仓</button>
                <button type="button" class="fc-op" @click.stop="openOp(row.fundCode, 'reduce')">减仓</button>
                <button type="button" class="fc-op" @click.stop="openOp(row.fundCode, 'edit')">编辑</button>
                <button type="button" class="fc-op fc-op-danger" @click.stop="$emit('clearHoldings', row.fundCode)">清空</button>
              </template>
              <button v-else type="button" class="fc-op fc-op-primary" @click.stop="openOp(row.fundCode, 'edit')">录入持仓</button>
            </div>
          </CardSection>
          <CardSection
            :mode="sectionMode"
            title="净值与走势"
            :open="isBlockOpen(row.fundCode, 'nav')"
            :active="isSectionActive(row.fundCode, 'nav')"
            :summary="row.lastNetValue > 0 ? row.lastNetValue.toFixed(4) : '--'"
            @update:open="setBlock(row.fundCode, 'nav', $event)"
          >
            <div class="fc-nav-row">
              <div class="fc-cell">
                <span class="fc-cell-label">昨日净值</span>
                <span class="fc-cell-val font-number">{{ row.lastNetValue > 0 ? row.lastNetValue.toFixed(4) : '--' }}</span>
              </div>
              <div class="fc-cell">
                <span class="fc-cell-label">最新净值</span>
                <span class="fc-cell-val font-number">{{ row.currentNav.toFixed(4) }}</span>
              </div>
              <div class="fc-cell">
                <span class="fc-cell-label">净值涨跌</span>
                <span :class="['fc-cell-val font-number', rateClass(row.netChangeRate)]">
                  {{ row.netChangeRate > 0 ? '+' : '' }}{{ row.netChangeRate.toFixed(2) }}%
                </span>
              </div>
            </div>
            <div class="fc-spark">
              <FundSparkline v-if="isSectionActive(row.fundCode, 'nav')" :points="row.intradayPoints" :change-rate="row.changeRate" :base-value="row.intradayBaseValue" />
            </div>
            <div v-if="isSectionActive(row.fundCode, 'nav') && navHistory(row.fundCode).length > 0" class="fc-navlist">
              <div class="fc-navlist-head">
                <span>日期</span>
                <span>净值</span>
                <span>涨跌</span>
              </div>
              <div class="fc-navlist-body">
              <div
                v-for="item in navHistory(row.fundCode)"
                :key="item.d"
                class="fc-navlist-row"
              >
                <span class="fc-nav-date">{{ item.d.slice(5) }}</span>
                <span class="fc-nav-val font-number">{{ item.v.toFixed(4) }}</span>
                <span
                  v-if="item.rate != null"
                  :class="['fc-nav-rate font-number', rateClass(item.rate)]"
                >{{ item.rate > 0 ? '+' : '' }}{{ item.rate.toFixed(2) }}%</span>
                <span v-else class="fc-nav-rate font-number text-flat">--</span>
              </div>
              </div>
              <p class="fc-navlist-foot">近 {{ navHistory(row.fundCode).length }} 个交易日</p>
            </div>
          </CardSection>
          <CardSection
            :mode="sectionMode"
            title="区间业绩"
            :open="isBlockOpen(row.fundCode, 'perf')"
            :active="isSectionActive(row.fundCode, 'perf')"
            :summary="perfSummary(row.fundCode)"
            @update:open="setBlock(row.fundCode, 'perf', $event)"
          >
            <div class="fc-perf">
              <div
                v-for="col in PERF_COLUMNS"
                :key="col.key"
                class="fc-perf-item"
                :class="perfValue(row.fundCode, col.key) != null ? rateBgClass(perfValue(row.fundCode, col.key)!) : 'perf-na'"
              >
                <span v-if="perfValue(row.fundCode, col.key) != null" class="fc-perf-val font-number">
                  {{ perfValue(row.fundCode, col.key)! > 0 ? '+' : '' }}{{ perfValue(row.fundCode, col.key)!.toFixed(2) }}%
                </span>
                <span v-else class="fc-perf-val font-number text-muted">--</span>
                <span class="fc-perf-label">{{ col.label }}</span>
              </div>
            </div>
            <FundNavTrend
              v-if="isSectionActive(row.fundCode, 'perf')"
              :points="perfMap.get(row.fundCode)?.nav ?? []"
              :change-rate="perfValue(row.fundCode, 'y1') ?? 0"
              :marks="marksOf(row.fundCode)"
            />
          </CardSection>
          <CardSection
            :mode="sectionMode"
            title="持仓股票"
            :open="isBlockOpen(row.fundCode, 'stocks')"
            :active="isSectionActive(row.fundCode, 'stocks')"
            summary="前十大"
            @update:open="setBlock(row.fundCode, 'stocks', $event)"
          >
            <HoldingStocks
              v-if="isSectionActive(row.fundCode, 'stocks')"
              :fund-code="row.fundCode"
              :delay-days="row.delayDays ?? 1"
            />
          </CardSection>
            </div>
          </div>
          <footer class="fc-foot">
            <button type="button" class="fc-act" @click.stop="goDetail(row.fundCode)">
              详情
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
            <div class="fc-foot-spacer" />
            <button type="button" class="fc-act fc-act-danger" @click.stop="$emit('removeFund', row.fundCode)" title="删除">
              <el-icon><Delete /></el-icon>
            </button>
          </footer>
        </article>
        <FanSelector
          v-if="displayRows.length > 1 && sectionMode === 'pane'"
          class="side-fan"
          vertical
          v-model="activeCardCode"
          :items="fanItems"
          :preview-offset="fanPreview"
          @drag="onFanDrag"
          @activate="goDetail"
        />
      </div>
      <div v-if="displayRows.length === 0" class="empty-state animate-fade-in">
        <el-icon :size="48" class="text-muted"><Warning /></el-icon>
        <p class="text-muted">暂无关注基金，点击搜索按钮添加</p>
      </div>
    </div>
    <Teleport to="body">
      <div v-if="popup.visible" class="longpress-halo" :style="haloStyle"></div>
      <div v-if="popup.visible" class="longpress-popup" :class="{ 'popup-above': popup.placement === 'above' }" :style="{ left: popup.x + 'px', top: popup.y + 'px' }">
        <span class="popup-arrow" :style="{ left: popup.arrowX + 'px', marginLeft: '0' }"></span>
        <button class="popup-btn popup-edit" @click.stop="handlePopupEdit">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span>编辑持仓</span>
        </button>
        <button class="popup-btn popup-clear" @click.stop="handlePopupClear">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>清空持仓</span>
        </button>
        <button class="popup-btn popup-delete" @click.stop="handlePopupDelete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
          <span>删除</span>
        </button>
      </div>
    </Teleport>
    <BottomSheet
      :visible="!!activeOp"
      :title="opTitle"
      center
      :mask-closable="false"
      @update:visible="(v) => { if (!v) closeOp() }"
    >
      <div class="op-form">
        <template v-if="activeOp === 'add'">
          <label class="op-label">投入金额</label>
          <div class="op-input-wrap">
            <span class="op-unit">¥</span>
            <input v-model.number="opForm.amount" type="number" min="0" class="op-input" placeholder="0.00" />
          </div>
          <p class="op-hint">参考净值 {{ opNav.toFixed(4) }}</p>
        </template>
        <template v-else-if="activeOp === 'reduce'">
          <label class="op-label">赎回份额</label>
          <div class="op-input-wrap">
            <input v-model.number="opForm.shares" type="number" min="0" class="op-input" placeholder="0.00" />
            <span class="op-unit op-unit-suffix">份</span>
          </div>
          <p class="op-hint">参考净值 {{ opNav.toFixed(4) }}</p>
        </template>
        <template v-else>
          <label class="op-label">持仓金额</label>
          <div class="op-input-wrap">
            <span class="op-unit">¥</span>
            <input v-model.number="opForm.holdingAmount" type="number" min="0" class="op-input" placeholder="0.00" />
          </div>
          <label class="op-label">累计收益</label>
          <div class="op-input-wrap">
            <span class="op-unit">¥</span>
            <input v-model.number="opForm.totalProfit" type="number" class="op-input" placeholder="0.00" />
          </div>
        </template>
        <div class="op-actions">
          <button type="button" class="fc-op" @click="closeOp">取消</button>
          <button type="button" class="fc-op fc-op-primary" @click="submitOp">确认</button>
        </div>
      </div>
    </BottomSheet>
  </div>
</template>
<script setup lang="ts">

import { computed, ref, reactive, onMounted, onUnmounted, onActivated, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'
import { takeLastVisitedFund } from '@/modules/fund/misc/last-visited-fund'
import { Delete, Warning } from '@element-plus/icons-vue'
import FundSparkline from '@/components/fund-list/fund-sparkline.vue'
import FundNavTrend from '@/components/fund-list/fund-nav-trend.vue'
import CardSection from '@/components/fund-list/card-section.vue'
import BottomSheet from '@/components/shared/bottom-sheet.vue'
import { ElMessage } from 'element-plus'
import { useLayoutMode } from '@/components/layout/use-layout-mode'
import HoldingStocks from '@/components/fund-list/holding-stocks.vue'
import FanSelector from '@/components/fund-list/fan-selector.vue'
import type { FanItem } from '@/components/fund-list/fan-selector.vue'
import FundToolbar from '@/components/fund-list/fund-toolbar.vue'
import { useSettingsStore } from '@/modules/settings/settings-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { PendingActionStatus } from '@/modules/holding/holding-types'
import { getTradeMarks, findDateByNav } from '@/modules/holding/trade-marks'
import { cardTab, cardNavRange, type CardTabKey } from '@/composables/use-view-prefs'
import type { FundRowData } from '@/composables/use-fund-data'
import { usePerfIntervals } from '@/composables/use-perf-intervals'
import type { PerfIntervals } from '@/modules/fund/perf/perf-intervals'
import type { ViewMode, SortField, SortDirection } from '@/modules/fund/fund-types'
import { STORAGE_KEYS } from '@/config/constants'
import { formatProfitCompact, formatCompactMoney } from '@/shared/utils/money-format'

const props = defineProps<{
  sortedRows: FundRowData[]
  viewMode: ViewMode
  sortField: SortField
  sortDirection: SortDirection
}>()

const emit = defineEmits<{
  removeFund: [fundCode: string]
  changeViewMode: [mode: ViewMode]
  changeSort: [field: SortField, dir: SortDirection]
  clearHoldings: [fundCode: string]
  quickRemoveFund: [fundCode: string]
}>()

const router = useRouter()
const settingsStore = useSettingsStore()
const holdingStore = useHoldingStore()
const groupStore = useGroupStore()
const p = computed(() => settingsStore.privacy)

interface PerfColumn { key: keyof Omit<PerfIntervals, 'nav' | 'navRecent'>; label: string; short: string }
const PERF_COLUMNS: PerfColumn[] = [
  { key: 'week', label: '近1周', short: '周' },
  { key: 'm1',   label: '近1月', short: '月' },
  { key: 'm3',   label: '近3月', short: '3月' },
  { key: 'm6',   label: '近6月', short: '6月' },
  { key: 'y1',   label: '近1年', short: '年' },
]

const fundCodes = computed(() => props.sortedRows.map(r => r.fundCode))
const { perfMap } = usePerfIntervals(fundCodes)

const perfSort = ref<{ key: PerfColumn['key']; dir: SortDirection } | null>(null)

function sortByPerf(key: PerfColumn['key']): void {
  if (perfSort.value?.key === key) {
    perfSort.value = { key, dir: perfSort.value.dir === 'desc' ? 'asc' : 'desc' }
  } else {
    perfSort.value = { key, dir: 'desc' }
  }
}

function sortByStoreField(field: SortField): void {
  perfSort.value = null
  handleSortCommand(field)
}

const activeCardCode = ref('')

const fanItems = computed<FanItem[]>(() =>
  displayRows.value.map(r => ({
    key: r.fundCode,
    name: r.fundName,
    rateText: r.hasTodayData
      ? `${r.changeRate > 0 ? '+' : ''}${r.changeRate.toFixed(2)}%`
      : '--',
    rateClass: r.hasTodayData ? rateClass(r.changeRate) : 'text-flat',
  })),
)

const cardDragX = ref(0)
const cardDragging = ref(false)

const fanPreview = ref(0)

const justSwiped = ref(false)
let swipeFlagTimer: ReturnType<typeof setTimeout> | null = null
function markSwiped(): void {
  justSwiped.value = true
  if (swipeFlagTimer) clearTimeout(swipeFlagTimer)
  swipeFlagTimer = setTimeout(() => { justSwiped.value = false }, 300)
}

function onFanDrag(dx: number): void {
  cardDragging.value = dx !== 0
  cardDragX.value = dx
  if (dx === 0) markSwiped()
}

const cardDragStyle = computed(() => {
  if (cardDragX.value === 0 && !cardDragging.value) return undefined
  const dx = cardDragX.value
  const dragging = cardDragging.value
  return {
    transform: `translate3d(${dx}px, 0, 0) scale(${dragging ? 0.985 : 1})`,

    transition: dragging
      ? 'none'
      : 'transform var(--duration-normal) var(--ease-spring), opacity var(--duration-fast) var(--ease-out-expo), box-shadow var(--duration-fast) var(--ease-out-expo)',

    opacity: String(Math.max(0.55, 1 - Math.abs(dx) / 420)),
    boxShadow: dragging ? 'var(--shadow-lg)' : undefined,
    zIndex: dragging ? '2' : undefined,
  }
})

let cardStartX = 0
let cardStartY = 0
let cardSwiping = false

const CARD_SWIPE_THRESHOLD = 60

const CARD_DRAG_DAMP = 0.55

function onCardTouchStart(e: TouchEvent, code: string): void {
  const t = e.touches[0]
  cardStartX = t.clientX
  cardStartY = t.clientY
  cardSwiping = false
  cardDragX.value = 0

  onTouchStart(e, code)
}

function onCardTouchMove(e: TouchEvent): void {
  const t = e.touches[0]
  const dx = t.clientX - cardStartX
  const dy = t.clientY - cardStartY
  if (!cardSwiping && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    cardSwiping = true
    cardDragging.value = true

    cancelLongPress()
  }
  if (cardSwiping) {
    cardDragX.value = dx * CARD_DRAG_DAMP

    fanPreview.value = cardDragX.value
  } else {
    onTouchMove(e)
  }
}

function onCardTouchEnd(e: TouchEvent): void {
  if (!cardSwiping) { onTouchEnd(e); return }
  cardSwiping = false
  cardDragging.value = false
  fanPreview.value = 0
  markSwiped()
  const dx = e.changedTouches[0].clientX - cardStartX
  if (Math.abs(dx) < CARD_SWIPE_THRESHOLD) {
    cardDragX.value = 0
    return
  }

  const dir = dx < 0 ? 1 : -1
  cardDragX.value = dx < 0 ? -320 : 320
  window.setTimeout(() => {
    stepCard(dir)

    cardDragging.value = true
    cardDragX.value = dx < 0 ? 320 : -320
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        cardDragging.value = false
        cardDragX.value = 0
      })
    })
  }, 200)
}

function stepCard(delta: number): void {
  const rows = displayRows.value
  const n = rows.length
  if (n <= 1) return
  const cur = rows.findIndex(r => r.fundCode === activeCardCode.value)

  const next = (((cur < 0 ? 0 : cur) + delta) % n + n) % n
  activeCardCode.value = rows[next].fundCode
}

const cardRows = computed<FundRowData[]>(() => {
  const rows = displayRows.value
  if (rows.length <= 1) return rows
  const hit = rows.find(r => r.fundCode === activeCardCode.value)
  return hit ? [hit] : rows.slice(0, 1)
})

const displayRows = computed<FundRowData[]>(() => {
  const ps = perfSort.value
  if (!ps) return props.sortedRows
  const dir = ps.dir === 'asc' ? 1 : -1
  return [...props.sortedRows].sort((a, b) => {
    const va = perfValue(a.fundCode, ps.key)
    const vb = perfValue(b.fundCode, ps.key)

    if (va == null && vb == null) return 0
    if (va == null) return 1
    if (vb == null) return -1
    return (va - vb) * dir
  })
})

function perfValue(fundCode: string, key: PerfColumn['key']): number | null {
  return perfMap.value.get(fundCode)?.[key] ?? null
}

const NAV_RECENT_DAYS = 15

function navHistory(fundCode: string): { d: string; v: number; rate: number | null }[] {
  const perf = perfMap.value.get(fundCode)
  const nav = perf?.navRecent ?? perf?.nav
  if (!nav || nav.length === 0) return []
  const out: { d: string; v: number; rate: number | null }[] = []

  for (let i = nav.length - 1; i >= 0; i--) {
    const cur = nav[i]
    const prev = i > 0 ? nav[i - 1] : null
    const rate = prev && prev.v > 0 ? ((cur.v - prev.v) / prev.v) * 100 : null
    out.push({ d: cur.d, v: cur.v, rate })
    if (out.length >= NAV_RECENT_DAYS) break
  }
  return out
}

function rateClass(v: number): string {
  return v > 0 ? 'text-rise' : v < 0 ? 'text-fall' : 'text-flat'
}

const STAGGER_MAX = 12
function staggerIndex(i: number): number {
  return i < STAGGER_MAX ? i : STAGGER_MAX
}

function pendingBadge(fundCode: string): { text: string; cls: string } | null {
  const list = holdingStore.pendingActions.filter(a =>
    a.fundCode === fundCode && a.status === PendingActionStatus.Pending)
  if (list.length === 0) return null
  const hasAdd = list.some(a => a.type === 'add')
  const hasReduce = list.some(a => a.type === 'reduce')
  const base = hasAdd && hasReduce ? '买卖' : hasAdd ? '买' : '卖'
  return {
    text: list.length > 1 ? `${base}${list.length}` : base,
    cls: hasReduce && !hasAdd ? 'badge-sell' : 'badge-buy',
  }
}

interface SortFieldOption { label: string; field: SortField }

const SORT_FIELDS: SortFieldOption[] = [
  { label: '持有金额',   field: 'holdingAmount' },
  { label: '今日收益',   field: 'todayProfit' },
  { label: '今日收益率', field: 'changeRate' },
  { label: '实时涨跌幅', field: 'realtimeGszzl' },
  { label: '累计收益',   field: 'totalProfit' },
  { label: '累计收益率', field: 'totalReturnRate' },
  { label: '昨日净值',   field: 'lastNetValue' },
  { label: '成本价',     field: 'costPrice' },
  { label: '基金名称',   field: 'fundName' },
  { label: '基金代码',   field: 'fundCode' },
]

const sortFieldsView = computed<SortFieldOption[]>(() =>
  settingsStore.enablePrediction ? SORT_FIELDS : SORT_FIELDS.filter(o => o.field !== 'realtimeGszzl'),
)

function handleSortCommand(field: SortField): void {
  const dir: SortDirection = props.sortField === field
    ? (props.sortDirection === 'desc' ? 'asc' : 'desc')
    : 'desc'
  emit('changeSort', field, dir)
}

function setViewMode(mode: ViewMode): void {
  if (mode === props.viewMode) return
  emit('changeViewMode', mode)
  localStorage.setItem(STORAGE_KEYS.VIEW_MODE, mode)
}

type BlockKey = CardTabKey
const openBlocks = ref<Set<string>>(new Set())

function blockId(code: string, key: BlockKey): string {
  return `${code}:${key}`
}
function isBlockOpen(code: string, key: BlockKey): boolean {
  if (key === 'holding') return !openBlocks.value.has(`!${blockId(code, key)}`)
  return openBlocks.value.has(blockId(code, key))
}
function setBlock(code: string, key: BlockKey, open: boolean): void {
  const next = new Set(openBlocks.value)
  if (key === 'holding') {
    const negKey = `!${blockId(code, key)}`
    if (open) next.delete(negKey)
    else next.add(negKey)
  } else {
    const id = blockId(code, key)
    if (open) next.add(id)
    else next.delete(id)
  }
  openBlocks.value = next
}

const { isMobile } = useLayoutMode()

const sectionMode = computed<'collapse' | 'pane'>(() => (isMobile.value ? 'collapse' : 'pane'))

const CARD_TABS: { key: BlockKey; label: string }[] = [
  { key: 'holding', label: '持仓与收益' },
  { key: 'nav', label: '净值与走势' },
  { key: 'perf', label: '区间业绩' },
  { key: 'stocks', label: '持仓股票' },
]

function activeTab(_code: string): BlockKey {
  return cardTab.value
}

function setActiveTab(_code: string, key: BlockKey): void {
  cardTab.value = key
}

function isSectionActive(code: string, key: BlockKey): boolean {
  return sectionMode.value === 'pane' ? activeTab(code) === key : isBlockOpen(code, key)
}

function marksOf(fundCode: string) {
  return getTradeMarks(holdingStore.groupActions, holdingStore.groupPendingActions, fundCode, groupStore.activeGroupId)
}

function tabSummary(row: FundRowData, key: BlockKey): string {
  if (key === 'holding') return holdingSummary(row)
  if (key === 'nav') return row.lastNetValue > 0 ? row.lastNetValue.toFixed(4) : '--'
  if (key === 'perf') return perfSummary(row.fundCode)
  return '前十大'
}

type OpType = 'add' | 'reduce' | 'edit'

const activeOp = ref<OpType | null>(null)
const opCode = ref('')

const opForm = reactive<{ amount: number | ''; shares: number | ''; holdingAmount: number | ''; totalProfit: number | '' }>({
  amount: '',
  shares: '',
  holdingAmount: '',
  totalProfit: '',
})

const opRow = computed<FundRowData | undefined>(() =>
  props.sortedRows.find(r => r.fundCode === opCode.value))

const opNav = computed(() => {
  const r = opRow.value
  return r && r.currentNav > 0 ? r.currentNav : 0
})

const opTitle = computed(() => {
  if (activeOp.value === 'add') return '加仓'
  if (activeOp.value === 'reduce') return '减仓'
  return (opRow.value?.holdingAmount ?? 0) > 0 ? '编辑持仓' : '录入持仓'
})

function openOp(code: string, type: OpType): void {
  opCode.value = code
  opForm.amount = ''
  opForm.shares = ''
  if (type === 'edit') {
    const r = props.sortedRows.find(x => x.fundCode === code)
    const amt = r?.holdingAmount ?? 0
    opForm.holdingAmount = amt > 0 ? parseFloat(amt.toFixed(2)) : ''
    opForm.totalProfit = amt > 0 ? parseFloat((r?.totalProfit ?? 0).toFixed(2)) : ''
  }
  activeOp.value = type
}

function closeOp(): void { activeOp.value = null }

function submitOp(): void {
  if (activeOp.value === 'add') submitAdd()
  else if (activeOp.value === 'reduce') submitReduce()
  else submitEdit()
}

function submitAdd(): void {
  if (!opForm.amount || opForm.amount <= 0) { ElMessage.warning('请输入有效金额'); return }
  const nav = opNav.value
  if (nav <= 0) { ElMessage.warning('当前净值不可用'); return }
  holdingStore.createPendingAdd(opCode.value, opForm.amount, nav, opRow.value?.delayDays ?? 1)
  ElMessage.success('加仓申请已提交，待净值确认后生效')
  closeOp()
}

function submitReduce(): void {
  if (!opForm.shares || opForm.shares <= 0) { ElMessage.warning('请输入有效份额'); return }
  const nav = opNav.value
  if (nav <= 0) { ElMessage.warning('当前净值不可用'); return }
  holdingStore.createPendingReduce(opCode.value, opForm.shares, nav, opRow.value?.delayDays ?? 1)
  ElMessage.success('减仓申请已提交，待净值确认后生效')
  closeOp()
}

function submitEdit(): void {
  if (!opForm.holdingAmount || opForm.holdingAmount <= 0) { ElMessage.warning('请输入持仓金额'); return }
  const nav = opNav.value > 0 ? opNav.value : 1
  const amount = opForm.holdingAmount
  const profit = opForm.totalProfit === '' ? 0 : opForm.totalProfit
  const shares = amount / nav
  const r = opRow.value

  // 成本价由「持仓金额 - 累计收益」反推，而不是当前净值 ——
  // 再按该成本净值回溯到历史上最接近的交易日，标记才落在真实建仓点。
  const principal = amount - profit
  const costNav = shares > 0 && principal > 0 ? principal / shares : nav
  const series = perfMap.value.get(opCode.value)?.nav
  const markDate = findDateByNav(series, costNav)

  holdingStore.replaceHoldingDirect(
    opCode.value, shares, costNav, amount, profit,
    { gszzl: r?.changeRate, isEstimated: r?.isEstimated, jzrq: undefined },
    markDate,
  )
  ElMessage.success('持仓已更新')
  closeOp()
}

function holdingSummary(row: FundRowData): string {
  if (row.holdingAmount <= 0) return '未持仓'
  if (!p.value.holding) return '••••'
  const profit = formatProfitCompact(row.todayProfit)
  return `¥${formatCompactMoney(row.holdingAmount)} · ${profit}`
}

function perfSummary(code: string): string {
  const y1 = perfValue(code, 'y1')
  if (y1 != null) return `近1年 ${y1 > 0 ? '+' : ''}${y1.toFixed(2)}%`
  const m1 = perfValue(code, 'm1')
  if (m1 != null) return `近1月 ${m1 > 0 ? '+' : ''}${m1.toFixed(2)}%`
  return '--'
}

function markStyle(code: string): Record<string, string> {
  return { '--mark-h': String(hueOf(code)) }
}

function hueOf(code: string): number {
  let h = 0
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) % 360
  return 190 + (h % 75)
}

const revealKey = ref(0)
const revealHue = ref(0)
watch(activeCardCode, (code) => {
  if (!code) return
  revealHue.value = hueOf(code)
  revealKey.value++
})

// 切换分组后 activeCardCode 可能还指向上一组的基金，卡片视图会退回兜底的第一张
// 且扇形选择器高亮错位，这里跟着新分组重置到首项。
watch(() => groupStore.activeGroupId, () => {
  activeCardCode.value = displayRows.value[0]?.fundCode ?? ''
})

function goManage(): void {
  router.push('/manage')
}

function handleRowClick(fundCode: string): void {
  if (longPressTriggered.value) { longPressTriggered.value = false; return }
  router.push(`/fund/${fundCode}`)
}

function handleCardClick(fundCode: string): void {
  if (longPressTriggered.value) { longPressTriggered.value = false; return }
  if (justSwiped.value) return
  router.push(`/fund/${fundCode}`)
}

function goDetail(fundCode: string): void {
  router.push(`/fund/${fundCode}`)
}

function restoreLastVisited(): void {
  const code = takeLastVisitedFund()
  if (!code) return
  void nextTick(() => {
    const el = listBodyEl.value?.querySelector<HTMLElement>(`[data-fund-row="${code}"]`)
    el?.scrollIntoView({ behavior: 'auto', block: 'center' })
  })
}

function rateBgClass(v: number): string {
  return v > 0 ? 'perf-rise' : v < 0 ? 'perf-fall' : 'perf-flat'
}

function truncateName(name: string): string {
  if (!name) return '--'
  return name.length > 11 ? name.slice(0, 11) + '…' : name
}

function formatDate(timeStr: string): string {
  if (!timeStr) return '--'

  const date = timeStr.slice(0, 10)
  return /^\d{4}-\d{1,2}-\d{1,2}$/.test(date) ? date.slice(5) : (timeStr || '--')
}

function isRealtimeBadgeVisible(source: string | undefined, hasHoldingsRatio = true): boolean {
  if (!source) return true
  if (source === '实时') return hasHoldingsRatio
  return true
}

const listBodyEl = ref<HTMLElement | null>(null)

const tableScrollEl = ref<HTMLElement | null>(null)

const hasOverflow = ref(false)
let snapTimer: ReturnType<typeof setTimeout> | null = null

let isSnapping = false
let snapUnlockTimer: ReturnType<typeof setTimeout> | null = null

function snapIfNeeded(): void {
  const el = tableScrollEl.value
  if (!el || !hasOverflow.value || isSnapping) return
  const maxLeft = el.scrollWidth - el.clientWidth
  if (maxLeft <= 0) return

  const w = dataColWidth.value
  if (w <= 0) return

  const k = Math.round(el.scrollLeft / w)
  const candidates = [
    Math.min(Math.max(k * w, 0), maxLeft),
    maxLeft,
  ]
  let target = candidates[0]
  let best = Math.abs(el.scrollLeft - candidates[0])
  for (let i = 1; i < candidates.length; i++) {
    const d = Math.abs(el.scrollLeft - candidates[i])
    if (d < best) { best = d; target = candidates[i] }
  }

  if (Math.abs(el.scrollLeft - target) <= 1) return

  isSnapping = true
  el.scrollTo({ left: target, behavior: 'smooth' })

  if (snapUnlockTimer) clearTimeout(snapUnlockTimer)
  snapUnlockTimer = setTimeout(() => { isSnapping = false }, 600)
}

const isScrolling = ref(false)

let lastScrollLeft = 0
let scrollingOffTimer: ReturnType<typeof setTimeout> | null = null

function onListScroll(): void {
  const el = tableScrollEl.value
  if (el && el.scrollLeft !== lastScrollLeft) {
    lastScrollLeft = el.scrollLeft

    if (!isSnapping) {
      isScrolling.value = true
      if (scrollingOffTimer) clearTimeout(scrollingOffTimer)
      scrollingOffTimer = setTimeout(() => { isScrolling.value = false }, 260)
    }
  }

  if (snapTimer) clearTimeout(snapTimer)
  snapTimer = setTimeout(snapIfNeeded, 140)
}

function onListTouchEnd(): void {
  axisLock.value = null
  axisStartX = 0
  axisStartY = 0
  axisDecided = false
  if (snapTimer) clearTimeout(snapTimer)
  snapTimer = setTimeout(snapIfNeeded, 160)
}

const axisLock = ref<'x' | 'y' | null>(null)
let axisStartX = 0
let axisStartY = 0
let axisDecided = false

const AXIS_THRESHOLD = 8

function onListTouchStart(e: TouchEvent): void {
  const t = e.touches[0]
  if (!t) return
  axisStartX = t.clientX
  axisStartY = t.clientY
  axisDecided = false
  axisLock.value = null

  if ((e.target as HTMLElement | null)?.closest?.('.col-ctrl')) {
    axisDecided = true
  }
}

function onListTouchMove(e: TouchEvent): void {
  if (axisDecided) return
  const t = e.touches[0]
  if (!t) return
  const dx = Math.abs(t.clientX - axisStartX)
  const dy = Math.abs(t.clientY - axisStartY)
  if (dx < AXIS_THRESHOLD && dy < AXIS_THRESHOLD) return
  axisDecided = true
  axisLock.value = dx > dy ? 'x' : 'y'
}

const dataColWidth = ref(0)

function measureOverflow(): void {
  const el = tableScrollEl.value
  if (!el) { hasOverflow.value = false; return }
  computeDataColWidth()
  hasOverflow.value = el.scrollWidth > el.clientWidth + 1
}

const MIN_DATA_COLS = 3
const MAX_DATA_COLS = 8

const IDEAL_DATA_COL_W = 88

function computeDataColWidth(): void {
  const el = tableScrollEl.value
  if (!el) return
  const container = el.clientWidth
  if (container <= 0) return

  const nameCell = el.querySelector<HTMLElement>('.col-ctrl')
  const nameW = nameCell?.getBoundingClientRect().width || 0
  const avail = container - nameW
  if (avail <= 0) return

  let n = Math.round(avail / IDEAL_DATA_COL_W)
  n = Math.max(MIN_DATA_COLS, Math.min(MAX_DATA_COLS, n))

  dataColWidth.value = Math.floor((avail / n) * 100) / 100
}

let resizeObserver: ResizeObserver | null = null

watch(() => [props.sortedRows.length, props.viewMode], () => {
  void nextTick(measureOverflow)
})

const LONG_PRESS_DURATION = 600
const MOVE_THRESHOLD = 10

interface PopupState {
  visible: boolean
  fundCode: string
  x: number
  y: number
  arrowX: number
  placement: 'below' | 'above'
}

const popup = ref<PopupState>({ visible: false, fundCode: '', x: 0, y: 0, arrowX: 0, placement: 'below' })
const haloStyle = ref<Record<string, string>>({})
let longPressTimer: ReturnType<typeof setTimeout> | null = null
let longPressStartX = 0
let longPressStartY = 0
const longPressTriggered = ref(false)

const suppressClickClose = ref(false)

const POPUP_WIDTH = 156
const POPUP_HEIGHT = 176
const ARROW_SIZE = 8
const GAP = 8
const EDGE_MARGIN = 8

function startLongPress(fundCode: string, x: number, y: number): void {
  longPressStartX = x
  longPressStartY = y
  longPressTriggered.value = false
  clearLongPressTimer()
  longPressTimer = setTimeout(() => {
    longPressTriggered.value = true
    window.getSelection()?.removeAllRanges()
    showPopup(fundCode)
  }, LONG_PRESS_DURATION)
}

function cancelLongPress(): void { clearLongPressTimer() }

function checkLongPressMove(x: number, y: number): void {
  const dx = Math.abs(x - longPressStartX)
  const dy = Math.abs(y - longPressStartY)
  if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) clearLongPressTimer()
}

function clearLongPressTimer(): void {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null }
}

function showPopup(fundCode: string): void {
  const rowEl = document.querySelector<HTMLElement>(`[data-fund-row="${fundCode}"]`)
  const row = rowEl?.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  if (row) {
    haloStyle.value = {
      left: `${Math.max(row.left, EDGE_MARGIN)}px`,
      top: `${Math.max(row.top, EDGE_MARGIN)}px`,
      width: `${Math.min(row.width, vw - EDGE_MARGIN * 2)}px`,
      height: `${Math.min(row.height, vh - EDGE_MARGIN * 2)}px`,
    }
  }

  const anchorCenterX = row ? row.left + row.width / 2 : vw / 2
  const rowTop = row ? row.top : 0
  const rowBottom = row ? row.bottom : vh / 2

  let x = anchorCenterX - POPUP_WIDTH / 2
  x = Math.max(EDGE_MARGIN, Math.min(x, vw - POPUP_WIDTH - EDGE_MARGIN))

  const ARROW_W = 12
  let arrowX = anchorCenterX - x - ARROW_W / 2
  arrowX = Math.max(EDGE_MARGIN, Math.min(arrowX, POPUP_WIDTH - ARROW_W - EDGE_MARGIN))

  const spaceBelow = vh - rowBottom - EDGE_MARGIN
  const spaceAbove = rowTop - EDGE_MARGIN
  let placement: 'below' | 'above' = 'below'
  let y: number
  if (spaceBelow >= POPUP_HEIGHT + GAP + ARROW_SIZE) {
    y = rowBottom + GAP + ARROW_SIZE
  } else if (spaceAbove >= POPUP_HEIGHT + GAP + ARROW_SIZE) {
    placement = 'above'
    y = rowTop - GAP - ARROW_SIZE - POPUP_HEIGHT
  } else {
    placement = spaceBelow >= spaceAbove ? 'below' : 'above'
    y = placement === 'below' ? rowBottom + GAP + ARROW_SIZE : rowTop - GAP - ARROW_SIZE - POPUP_HEIGHT
    y = Math.max(EDGE_MARGIN, Math.min(y, vh - POPUP_HEIGHT - EDGE_MARGIN))
  }

  popup.value = { visible: true, fundCode, x, y, arrowX, placement }
  suppressClickClose.value = true
}

function hidePopup(): void {
  popup.value.visible = false
  haloStyle.value = {}
  suppressClickClose.value = false
}

function handlePopupEdit(): void {
  const code = popup.value.fundCode
  hidePopup()
  router.push(`/fund/${code}?action=edit`)
}

function handlePopupDelete(): void {
  const code = popup.value.fundCode
  hidePopup()
  emit('quickRemoveFund', code)
}

function handlePopupClear(): void {
  const code = popup.value.fundCode
  hidePopup()
  emit('clearHoldings', code)
}

function onTouchStart(e: TouchEvent, fundCode: string): void {
  const t = e.touches[0]

  window.getSelection()?.removeAllRanges()
  startLongPress(fundCode, t.clientX, t.clientY)
}
function onTouchMove(e: TouchEvent): void {
  checkLongPressMove(e.touches[0].clientX, e.touches[0].clientY)
}
function onTouchEnd(_e: TouchEvent): void { cancelLongPress() }

function onMouseDown(e: MouseEvent, fundCode: string): void {
  if (e.button !== 0) return
  startLongPress(fundCode, e.clientX, e.clientY)
}
function onMouseMove(e: MouseEvent): void { checkLongPressMove(e.clientX, e.clientY) }
function onMouseUp(): void { cancelLongPress() }
function onContextMenu(_e: MouseEvent): void {  }

function onDocumentClick(_e: MouseEvent): void {
  if (suppressClickClose.value) { suppressClickClose.value = false; return }
  if (popup.value.visible) hidePopup()
}
function onDocumentScroll(): void { if (popup.value.visible) hidePopup() }

onMounted(() => {
  cardTab.value = 'holding'
  cardNavRange.value = 'y1'
  document.addEventListener('click', onDocumentClick, true)
  document.addEventListener('scroll', onDocumentScroll, true)

  void nextTick(measureOverflow)
  if (typeof ResizeObserver !== 'undefined' && listBodyEl.value) {
    resizeObserver = new ResizeObserver(() => measureOverflow())
    resizeObserver.observe(listBodyEl.value)
  }
})

onActivated(restoreLastVisited)
onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, true)
  document.removeEventListener('scroll', onDocumentScroll, true)
  clearLongPressTimer()
  if (snapTimer) { clearTimeout(snapTimer); snapTimer = null }
  if (snapUnlockTimer) { clearTimeout(snapUnlockTimer); snapUnlockTimer = null }
  if (scrollingOffTimer) { clearTimeout(scrollingOffTimer); scrollingOffTimer = null }
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>
<style scoped>
.fund-list-container {
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.list-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-x: hidden;
  overflow-y: auto;
  justify-content: flex-start;

  overscroll-behavior: none;
  box-sizing: border-box;
}

.list-body.body-table {
  overflow: hidden;
}

.list-body.lock-x .table-view { touch-action: pan-x; }
.list-body.lock-y .table-view { touch-action: pan-y; }

.fund-table td.col-ctrl,
.fund-table th.col-ctrl { touch-action: pan-y; }

.table-view {
  margin-top: var(--spacing-sm);
  overflow: auto;
  flex: 0 1 auto;
  min-height: 0;
  max-height: calc(100% - var(--spacing-sm));
  overscroll-behavior: none;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
}

.table-scroll {
  width: max-content;
  min-width: 100%;
  background: var(--bg-card);
}

.fund-table thead th:first-child { border-top-left-radius: var(--radius-lg); }
.fund-table thead th:last-child { border-top-right-radius: var(--radius-lg); }
.fund-table tbody tr:last-child td:first-child { border-bottom-left-radius: var(--radius-lg); }
.fund-table tbody tr:last-child td:last-child { border-bottom-right-radius: var(--radius-lg); }

.fund-table th.sticky-col-header { border-top-left-radius: var(--radius-lg); }
.fund-table tbody tr:last-child td.sticky-col { border-bottom-left-radius: var(--radius-lg); }

.fund-table {
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;

  width: max-content;
}

.col-ctrl { width: 168px; }
.col-todayProfit,
.col-totalProfit,
.col-lastNetValue,
.col-perf {
  width: var(--data-col-w, 96px);
}

.fund-table th {
  padding: 0 var(--spacing-sm);
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);

  text-align: right;
  letter-spacing: 0.02em;

  border-bottom: none;
  box-shadow: 0 1px 0 var(--border-subtle);
  white-space: nowrap;
  user-select: none;
  background: var(--bg-surface);
  position: sticky;
  top: 0;
  z-index: 8;
  height: 34px;
  box-sizing: border-box;
}

.fund-table th::before {
  content: '';
  position: absolute;
  top: -8px;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-surface);
  pointer-events: none;
}

.fund-table th > * { position: relative; }

.fund-table th.col-ctrl { text-align: left; }

.fund-table th:not(.col-ctrl) { cursor: pointer; }
.th-sortable {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  transition: color var(--transition-fast);
}
.fund-table th:not(.col-ctrl):hover .th-sortable { color: var(--text-primary); }
.th-sortable.on { color: var(--color-primary); font-weight: 600; }

.th-arrow {
  width: 0;
  height: 0;
  border-left: 3.5px solid transparent;
  border-right: 3.5px solid transparent;
  border-top: 4.5px solid currentColor;
  transition: transform var(--transition-fast);
}
.th-arrow.asc { transform: rotate(180deg); }

.fund-table td {
  padding: var(--spacing-sm);
  font-size: 13px;

  border-bottom: 1px solid var(--border-subtle);
  white-space: nowrap;
  background: var(--bg-card);
  vertical-align: middle;
  text-align: right;
}
.fund-table td.col-ctrl { text-align: left; }

.fund-table tbody tr:last-child td { border-bottom: none; }

.fund-table td.sticky-col {
  position: sticky;
  left: 0;
  z-index: 5;
  --sticky-bg: var(--bg-card);
  background: var(--sticky-bg);
  border-right: none;

  box-shadow:
    1px 0 0 var(--sticky-bg),
    2px 0 0 var(--border-hover);
  transition: box-shadow 0.22s ease;
}

.fund-table td.sticky-col::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -8px;
  right: 0;
  background: var(--sticky-bg);
  pointer-events: none;
}

.fund-table td.sticky-col > * { position: relative; }

.fund-table th.sticky-col-header {
  position: sticky;
  left: 0;
  top: 0;
  z-index: 9;
  background: var(--bg-surface);
  border-right: none;
  box-shadow:
    2px 0 0 var(--border-hover),
    0 1px 0 var(--border-default);
}

.fund-table th.sticky-col-header::before {
  content: '';
  position: absolute;
  top: -8px;
  bottom: 0;
  left: -8px;
  right: 0;
  background: var(--bg-surface);
  pointer-events: none;
}

.fund-table th.sticky-col-header > * { position: relative; }

.table-view.is-scrolling .fund-table td.sticky-col {
  box-shadow:
    1px 0 0 var(--sticky-bg),
    2px 0 0 var(--color-primary);
}

.fund-row {
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

@media (hover: hover) {
  .fund-row:hover td { background: var(--bg-card-hover); }
  .fund-row:hover td.sticky-col { --sticky-bg: var(--bg-card-hover); }
}

.fund-row,
.fund-row td { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.fund-row.longpress-active { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }

.ctrl-stack {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 2px 0;
}
.ctrl-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
.ctrl-holding {
  font-size: 11px;
  color: var(--text-muted);
}

.ctrl-holding-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  white-space: nowrap;
  min-width: 0;
}
.ctrl-holding-row .ctrl-date {
  margin-left: auto;
}
.ctrl-date {
  font-size: 10px;
  color: var(--text-muted);
}
.ctrl-pending-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  line-height: 1;
  padding: 2px 5px;
  border-radius: var(--radius-full);
  white-space: nowrap;
  flex-shrink: 0;
}
.ctrl-pending-badge.badge-buy {
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.12);
}
.ctrl-pending-badge.badge-sell {
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.12);
}

.ctrl-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 16px;
}

.ctrl-updated {
  display: inline-block;
  font-size: 9px;
  line-height: 1;
  padding: 2px 5px;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-glow);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}
.ctrl-realtime {
  display: inline-flex;
  align-items: baseline;
  gap: 3px;
  font-size: 11px;
  font-weight: 500;
}
.ctrl-realtime .rt-value { font-variant-numeric: tabular-nums; }
.ctrl-realtime .rt-label {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: var(--radius-full);
  background: rgba(59, 130, 246, 0.16);
  color: #3b82f6;
  line-height: 1.4;
}
.ctrl-realtime.rt-rise { color: #ef4444; }
.ctrl-realtime.rt-fall { color: #22c55e; }
.ctrl-realtime.rt-flat { color: var(--text-muted); }

.dual-row {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
  min-width: 0;
}

.dual-main {
  font-size: 12px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dual-sub {
  font-size: 10px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  opacity: 0.85;
}

.col-todayProfit,
.col-totalProfit,
.col-lastNetValue {
  text-align: right;
}

.fund-table th.col-todayProfit,
.fund-table th.col-totalProfit,
.fund-table th.col-lastNetValue {
  text-align: right;
}

.col-lastNetValue .dual-main {
  font-size: 12px;
  font-weight: 400;
}

/* 每行一个呼吸点，几十只自选就是几十个并发动画。
   transform/opacity 走合成，代价可控；切后台由全局 .app-hidden 统一冻结。 */
.rt-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  background: #22d3ee;
  animation: rt-breathe 1.6s ease-in-out infinite;
}
@keyframes rt-breathe {
  0%, 100% { opacity: 0.35; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.1); }
}

.rt-placeholder { opacity: 0.5; }
.rt-placeholder .rt-dot {
  background: transparent;
  border: 1.5px solid var(--text-muted);
  border-top-color: transparent;
  width: 7px;
  height: 7px;
  animation: rt-spin 0.8s linear infinite;
}
@keyframes rt-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-md);
  padding: var(--spacing-2xl) var(--spacing-lg);
  text-align: center;
}
.empty-state p {
  margin: 0;
  font-size: var(--font-sm);
  line-height: 1.7;
}

.card-view {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);

  margin-top: var(--spacing-sm);
  flex: none;
}

.card-view > .fan + .fund-card { margin-top: calc(-1 * var(--spacing-sm)); }

.fund-card.is-dragging { will-change: transform; }

.fc-reveal {
  position: absolute;
  top: 0;
  left: 50%;
  width: 200%;
  aspect-ratio: 1;
  transform: translate(-50%, -35%) scale(0.04);
  border-radius: var(--radius-full);
  background: radial-gradient(
    circle,
    hsl(var(--reveal-h, 210) 70% 55% / 0.22) 0%,
    hsl(var(--reveal-h, 210) 70% 55% / 0.10) 45%,
    transparent 70%
  );
  pointer-events: none;
  z-index: 0;
  opacity: 0;
  animation: fcReveal 900ms var(--ease-out-expo) forwards;
}
@keyframes fcReveal {
  0%   { transform: translate(-50%, -35%) scale(0.04); opacity: 0; }

  18%  { opacity: 1; }
  40%  { transform: translate(-50%, -35%) scale(1); opacity: 0.9; }
  100% { transform: translate(-50%, -35%) scale(1.05); opacity: 0; }
}

.fund-card > *:not(.fc-reveal) { position: relative; z-index: 1; }


.fund-card {
  display: flex;
  flex-direction: column;

  position: relative;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  transition: border-color var(--transition-fast),
              transform var(--duration-micro) var(--ease-out-expo);

  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;

  overflow: clip;
  clip-path: inset(0 round var(--radius-lg));
}
@media (hover: hover) {
  .fund-card:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-md);
  }
}
.fund-card:active:not(.is-dragging) { transform: scale(0.988); }
.fund-card.longpress-active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 1px var(--color-primary-glow), var(--shadow-md);
}

.fc-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}
@media (hover: hover) {
  .fc-head:hover { background: var(--bg-card-hover); }
}

.fc-mark {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: var(--radius-md);
  font-size: var(--font-lg);
  font-weight: 700;
  line-height: 1;
}

.fc-ident { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.fc-name-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
.fc-name {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fc-confirmed { color: var(--color-accent); font-weight: 700; font-size: 12px; flex-shrink: 0; }

.fc-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fc-code {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--border-subtle);
}
.fc-time { font-size: 11px; color: var(--text-muted); }

.fc-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  white-space: nowrap;
}
.fc-badge.badge-buy { background: var(--color-rise-glow); color: var(--color-rise); }
.fc-badge.badge-sell { background: var(--color-fall-glow); color: var(--color-fall); }
.fc-badge-updated { background: var(--color-accent-soft); color: var(--color-accent); }

.fc-rate {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}
.fc-rate-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px;
}

.fc-rate.is-labeled {
  flex-direction: row;
  align-items: stretch;
  gap: var(--spacing-md);
}
.fc-rate.is-labeled .fc-rate-item {
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 76px;
  padding: 2px var(--spacing-sm);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}
.fc-rate.is-labeled .fc-rate-item + .fc-rate-item {
  border: 1px solid var(--border-subtle);
  background: transparent;
}
.fc-rate-label {
  font-size: 10px;
  color: var(--text-muted);
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.fc-rate.is-labeled .fc-rate-val { font-size: var(--font-lg); }

@media (max-width: 767px) {
  .fc-rate.is-labeled { gap: 6px; }
  .fc-rate.is-labeled .fc-rate-item {
    min-width: 62px;
    padding: 2px 6px;
  }
  .fc-rate.is-labeled .fc-rate-val { font-size: var(--font-md); }
  .fc-rate-label { font-size: 9px; }
}

.fc-rate-val {
  font-size: var(--font-xl);
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.fc-rt {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
}
.fc-rt.rt-rise { color: var(--color-rise); }
.fc-rt.rt-fall { color: var(--color-fall); }
.fc-rt.rt-flat { color: var(--text-muted); }

.fc-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm) var(--spacing-md);
}
.fc-nav-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}
.fc-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.fc-cell-label { font-size: 11px; color: var(--text-muted); white-space: nowrap; }
.fc-cell-val {
  font-size: var(--font-sm);
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fc-spark { height: 56px; }

.fc-navlist {
  margin-top: var(--spacing-sm);
  border-top: 1px solid var(--border-subtle);
}
.fc-navlist-head,
.fc-navlist-row {
  display: grid;

  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--spacing-sm);
  align-items: center;
}
.fc-navlist-head {
  padding: var(--spacing-sm) 0 5px;
  font-size: 10px;
  color: var(--text-muted);
  letter-spacing: 0.04em;
}
.fc-navlist-head > :nth-child(2),
.fc-navlist-row > :nth-child(2) { text-align: center; }
.fc-navlist-head > :nth-child(3),
.fc-navlist-row > :nth-child(3) { text-align: right; }

.fc-navlist-body {
  max-height: 260px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.fc-navlist-row {
  padding: 4px 0;
  font-size: 12px;
}
.fc-navlist-foot {
  margin: 0;
  padding-top: 6px;
  border-top: 1px solid var(--border-subtle);
  font-size: 10px;
  color: var(--text-muted);
  text-align: center;
}

.fc-nav-date { color: var(--text-muted); font-variant-numeric: tabular-nums; }
.fc-nav-val { color: var(--text-primary); font-weight: 500; font-variant-numeric: tabular-nums; }
.fc-nav-rate { font-weight: 600; font-variant-numeric: tabular-nums; }

.fc-perf {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  margin-bottom: var(--spacing-sm);
}

.fc-perf-item {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 2px;
  padding: 6px 2px;
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
}
.fc-perf-item.perf-na { opacity: 0.55; }
.fc-perf-val {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.fc-perf-item.perf-rise .fc-perf-val { color: var(--color-rise); }
.fc-perf-item.perf-fall .fc-perf-val { color: var(--color-fall); }

.fc-perf-item.perf-flat .fc-perf-val { color: var(--text-secondary); }
.fc-perf-label { font-size: 10px; color: var(--text-muted); white-space: nowrap; }

.fc-body.is-stack { display: block; }

.card-view.has-side-fan {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: stretch;
  gap: var(--spacing-sm);
}
.card-view.has-side-fan > .fund-card { min-width: 0; }
.side-fan { align-self: stretch; }

.fc-body.is-split {
  display: grid;
  grid-template-columns: minmax(104px, 132px) 1fr;
  border-top: 1px solid var(--border-subtle);
  height: 248px;
}

.fc-rail {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-sm);
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-elevated, transparent);
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
}
.fc-rail::-webkit-scrollbar { display: none; }
.fc-rail-btn {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px 9px;
  border: none;
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  text-align: left;
  min-width: 0;
  transition: background-color var(--transition-fast), color var(--transition-fast);
}
.fc-rail-btn:hover { background: var(--border-subtle); color: var(--text-primary); }
.fc-rail-btn.on {
  background: var(--color-primary-glow);
  color: var(--color-primary-light);
}

.fc-rail-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fc-rail-sum {
  font-size: 10px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fc-rail-btn.on .fc-rail-sum { color: inherit; opacity: 0.75; }

.fc-panes { min-width: 0; }

.is-split .fc-panes {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--border-default) transparent;
  display: flex;
  flex-direction: column;
}
.is-split .fc-panes::-webkit-scrollbar { width: 6px; }
.is-split .fc-panes::-webkit-scrollbar-track { background: transparent; }
.is-split .fc-panes::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: var(--radius-full);
}
.is-split .fc-panes::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

.is-split :deep(.pane-body) {
  margin-block: auto;
  width: 100%;
}
.is-split .fc-grid,
.is-split .fc-nav-row {
  justify-items: center;
  text-align: center;
}

.is-split .fc-grid {
  gap: var(--spacing-sm);
}
.is-split .fc-grid .fc-cell {
  width: 100%;
  padding: 10px 8px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  gap: 4px;
}
.is-split .fc-grid .fc-cell-label {
  font-size: 10px;
  letter-spacing: 0.02em;
}
.is-split .fc-grid .fc-cell-val {
  font-size: var(--font-lg);
  font-weight: 700;
  line-height: 1.15;
}

.fc-ops {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-top: var(--spacing-md);
}
.fc-op {
  padding: 5px 12px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color var(--transition-fast), color var(--transition-fast), background-color var(--transition-fast);
}
.fc-op:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-light);
}
.fc-op-primary {
  border-color: var(--color-primary);
  background: var(--color-primary-glow);
  color: var(--color-primary-light);
}
.fc-op-danger:hover {
  border-color: var(--color-fall);
  color: var(--color-fall);
}

.op-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm) 0;
}
.op-label {
  font-size: var(--font-xs);
  color: var(--text-muted);
}
.op-input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px var(--spacing-sm);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  background: var(--bg-surface);
}
.op-input-wrap:focus-within { border-color: var(--color-primary); }
.op-unit { font-size: var(--font-sm); color: var(--text-muted); flex-shrink: 0; }
.op-unit-suffix { margin-left: auto; }
.op-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: var(--font-md);
  font-variant-numeric: tabular-nums;
  outline: none;
}
.op-hint { font-size: 11px; color: var(--text-muted); }
.op-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
.op-actions .fc-op { padding: 7px 20px; }
.is-split .fc-grid .fc-cell,
.is-split .fc-nav-row .fc-cell {
  align-items: center;
}

.fc-foot {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}
.fc-foot-spacer { flex: 1; }
.fc-act {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-default);
  background: transparent;
  color: var(--text-secondary);
  font-size: var(--font-xs);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast),
              color var(--transition-fast);
}
.fc-act:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-primary);
}
.fc-act-danger { padding: 5px 10px; }
.fc-act-danger:hover {
  background: var(--color-rise-glow);
  border-color: var(--color-rise);
  color: var(--color-rise);
}

@media (max-height: 900px) and (min-width: 768px) {
  .fc-head { padding: var(--spacing-sm) var(--spacing-md); gap: var(--spacing-sm); }
  .fc-mark { width: 32px; height: 32px; font-size: var(--font-md); }
  .fc-name { font-size: var(--font-sm); }
  .fc-rate-val { font-size: var(--font-lg); }

  :deep(.block-head) { padding: 6px var(--spacing-md); }
  :deep(.block-inner) { padding: 0 var(--spacing-md) var(--spacing-sm); }
  .fc-foot { padding: 6px var(--spacing-md); }
  .fc-spark { height: 48px; }
  .fc-navlist-body { max-height: 180px; }
}

@media (max-height: 760px) and (min-width: 768px) {
  .fc-head { padding: 6px var(--spacing-md); }
  .fc-mark { width: 28px; height: 28px; font-size: var(--font-sm); }
  .fc-rate-val { font-size: var(--font-md); }
  :deep(.block-head) { padding: 5px var(--spacing-md); }
  .fc-spark { height: 42px; }
  .fc-navlist-body { max-height: 150px; }
}

@media (max-width: 767px) {
  .col-ctrl  { width: min(96px, 28vw); }
  .perf-cell { font-size: 11px; }

  .dual-main { font-size: 11px; }
  .dual-sub { font-size: 9px; }
  .col-lastNetValue .dual-main { font-size: 11px; }

  .fc-head { padding: var(--spacing-sm) var(--spacing-md); }
  .fc-mark { width: 34px; height: 34px; font-size: var(--font-md); }
  .fc-name { font-size: var(--font-sm); }
  .fc-rate-val { font-size: var(--font-lg); }

  .fc-cell-label { font-size: 10px; }
  .fc-cell-val { font-size: var(--font-xs); }

  .fc-perf { grid-template-columns: repeat(3, 1fr); }
}
</style>
<style>

.longpress-halo {
  position: fixed;
  z-index: 9998;
  pointer-events: none;
  border: 1.5px dashed var(--color-primary);
  border-radius: var(--radius-lg);
  box-shadow: 0 0 16px var(--color-primary-glow), inset 0 0 12px var(--color-primary-glow);
  animation: halo-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes halo-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

.longpress-popup {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 156px;
  padding: 6px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04) inset;
  animation: popup-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  color: var(--text-secondary);
}
.popup-arrow {
  position: absolute;
  top: -7px;
  width: 12px;
  height: 12px;
  background: var(--glass-bg);
  border-left: 1px solid var(--border-default);
  border-top: 1px solid var(--border-default);
  transform: rotate(45deg);
  border-top-left-radius: 3px;
}
.longpress-popup.popup-above .popup-arrow {
  top: auto; bottom: -7px;
  border-top: none; border-left: none;
  border-right: 1px solid var(--border-default);
  border-bottom: 1px solid var(--border-default);
  border-top-left-radius: 0; border-bottom-right-radius: 3px;
}
@keyframes popup-in {
  from { opacity: 0; transform: scale(0.85); }
  to   { opacity: 1; transform: scale(1); }
}
.popup-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;
  white-space: nowrap;
}
.popup-btn:active { transform: scale(0.97); }
.popup-edit:hover { background: var(--color-primary-glow); color: var(--color-primary); }
.popup-clear:hover { background: var(--color-accent-soft); color: var(--color-accent); }
.popup-delete:hover { background: var(--color-rise-glow); color: var(--color-rise); }

.is-active-sort {
  color: var(--color-primary-light) !important;
  background: var(--color-primary-glow) !important;
  font-weight: 600;
}
.is-active-sort:hover {
  background: var(--color-primary-glow) !important;
  color: var(--color-primary-light) !important;
}

</style>
