import type {
  IAuthRepository,
  IPasswordService,
  ITokenService,
} from "./auth.interfaces.js";
import type { AuthResponse, LoginInput, User } from "./auth.types.js";
import { AppError } from "../../utils/api-error.js";
import logger from "../../services/logger.service.js";

interface PgErrorLike {
  code?: string;
}

export class AuthService {
  constructor(
    private readonly authRepository: IAuthRepository,
    private readonly passwordService: IPasswordService,
    private readonly tokenService: ITokenService,
  ) {}

  async register(email: string, password: string): Promise<AuthResponse> {
    const normalizedEmail = email.trim().toLowerCase();
    const passwordHash = await this.passwordService.hash(password);

    let user: User;

    try {
      user = await this.authRepository.createUser({
        email: normalizedEmail,
        passwordHash,
      });
    } catch (error) {
      const pgError = error as PgErrorLike;

      if (pgError?.code === "23505") {
        throw new AppError(
          409,
          "An account with this email already exists",
          "EMAIL_ALREADY_EXISTS",
        );
      }

      throw error;
    }

    logger.info("User registered", {
      userId: user.id,
      role: user.role,
    });

    return this.createAuthResponse(user);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const user = await this.authRepository.findByEmail(email);

    if (!user) {
      throw new AppError(
        401,
        "Invalid email or password",
        "INVALID_CREDENTIALS",
      );
    }

    const passwordMatches = await this.passwordService.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new AppError(
        401,
        "Invalid email or password",
        "INVALID_CREDENTIALS",
      );
    }

    logger.info("User logged in", {
      userId: user.id,
      role: user.role,
    });

    return this.createAuthResponse(user);
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.authRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found", "USER_NOT_FOUND");
    }

    return user;
  }

  private createAuthResponse(user: User): AuthResponse {
    return {
      user,
      accessToken: this.tokenService.sign(user),
      tokenType: "Bearer",
      expiresIn: 3600,
    };
  }
}
