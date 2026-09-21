import jwt from "jsonwebtoken";
import { IUser } from "../src/models/user-model";
import {
    generateAccessToken,
    generateRefreshToken,
} from "../src/utils/generate-token";

describe('token generators', () => {
    const createMockUser = (overrides: Partial<IUser> = {}): IUser => {
        const defaultUser: IUser = {
            id: "123",
            email: "test@example.com",
            password: "password123",
            fullName: "Test User",
            role: "user",
            refreshToken: null,
            refreshTokenExpiresAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides,
        } as IUser;
        return defaultUser;
    };

    beforeEach(() => {
        // Reset the process.env and re-define JWT_SECRET before each test
        jest.resetModules();
        process.env.JWT_SECRET = "testsecret";
    });

    test('Case: Create an access token with the access claim', () => {
        const user = createMockUser();
        const token = generateAccessToken(user);
        const decoded = jwt.verify(token, "testsecret") as {
            id: string;
            email: string;
            role: string;
            type: string;
            iat: number;
            exp: number;
        };
        expect(decoded.id).toBe(user.id);
        expect(decoded.email).toBe(user.email);
        expect(decoded.role).toBe(user.role);
        expect(decoded.type).toBe("access");
    });

    test('Case: Access token expires after 15 minutes', () => {
        const user = createMockUser();
        const token = generateAccessToken(user);
        const decoded = jwt.verify(token, "testsecret") as { exp: number };
        const now = Math.floor(Date.now() / 1000);
        expect(decoded.exp - now).toBeCloseTo(900, 1);
    });

    test('Case: Refresh token has the refresh claim and seven-day expiry', () => {
        const token = generateRefreshToken(createMockUser());
        const decoded = jwt.verify(token, "testsecret") as {
            type: string;
            exp: number;
        };
        const now = Math.floor(Date.now() / 1000);
        expect(decoded.type).toBe("refresh");
        expect(decoded.exp - now).toBeCloseTo(7 * 24 * 60 * 60, 1);
    });

    test('Case: Throw an error if JWT_SECRET is not defined', () => {
        // Temporarily delete JWT_SECRET
        const originalSecret = process.env.JWT_SECRET; // store old secret
        delete process.env.JWT_SECRET;
        try {
            const user = createMockUser();
            expect(() => generateAccessToken(user)).toThrow(
                "JWT_SECRET is not defined in the environment variables."
            );
        } finally {
            process.env.JWT_SECRET = originalSecret; // restore secret
        }
    });
});
