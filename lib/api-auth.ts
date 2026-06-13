import { auth } from "@/lib/auth"

export class UnauthorizedError extends Error {
  constructor(message = "UNAUTHORIZED") {
    super(message)
    this.name = "UnauthorizedError"
  }
}

export async function requireApiAuth(): Promise<string> {
  const session = await auth()
  if (session?.user?.id) {
    return session.user.id
  }

  throw new UnauthorizedError()
}
