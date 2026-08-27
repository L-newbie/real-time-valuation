

export interface GameEntry {
  id: string

  name: string

  desc: string

  path: string
}

export const GAMES: GameEntry[] = [
  {
    id: 'cicada',
    name: '竹知了',
    desc: '按住画圈甩起来，转得越快叫得越响',
    path: '/games/cicada',
  },
]
