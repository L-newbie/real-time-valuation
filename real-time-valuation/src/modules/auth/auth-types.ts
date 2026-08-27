

export interface AuthUser {
  email: string

  nickname: string

  passwordHash: string

  salt: string

  createdAt: number
}

export interface AuthSession {
  email: string

  loginAt: number
}

export interface StoredAuth {
  users: AuthUser[]
  session: AuthSession | null
}
