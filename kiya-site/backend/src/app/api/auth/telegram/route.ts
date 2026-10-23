import { endpoint, readBody, sameOrigin } from "@/server/http";
import { telegramLogin, telegramInput } from "@/server/telegram";
export async function POST(r: Request) {
  return endpoint(async () => {
    sameOrigin(r);
    return telegramLogin(r, await readBody(r, telegramInput));
  });
}
