import { z } from "zod";
import { telegramOtp, otpInput } from "@/server/telegram-otp";
import { endpoint, readBody, sameOrigin } from "@/server/http";
import { telegramLogin, telegramInput } from "@/server/telegram";
export async function POST(r: Request) {
  return endpoint(async () => {
    sameOrigin(r);
    const input = await readBody(r, z.union([telegramInput, otpInput]));
    return input.action === "otp-start" || input.action === "otp-verify"
      ? telegramOtp(r, input)
      : telegramLogin(r, input);
  });
}
