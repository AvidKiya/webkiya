import { endpoint, ok, readBody, sameOrigin } from "@/server/http";
import { readSettings, saveSettings, settingsInput } from "@/server/settings";
export async function GET(r: Request) {
  return endpoint(async () => ok(await readSettings(r)));
}
export async function PUT(r: Request) {
  return endpoint(async () => {
    sameOrigin(r);
    return ok(await saveSettings(r, await readBody(r, settingsInput)));
  });
}
