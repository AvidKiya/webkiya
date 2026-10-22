import "server-only";
import { join } from "node:path";
export function mediaDirectory() {
  return process.env.MEDIA_ROOT || join(process.cwd(), ".data/media");
}
