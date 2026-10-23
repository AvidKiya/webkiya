import { endpoint, readBody, ok } from "@/server/http";
import {
  telegramWebhook,
  acceptTelegramUpdate,
  updateInput,
} from "@/server/telegram";
export async function POST(r: Request) {
  return endpoint(async () => {
    await telegramWebhook(r);
    return ok(
      await acceptTelegramUpdate(await readBody(r, updateInput, 65536)),
    );
  });
}
