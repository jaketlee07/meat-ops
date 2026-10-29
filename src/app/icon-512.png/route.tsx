import { appIcon } from "../app-icon";

export const dynamic = "force-static";

export function GET() {
  return appIcon(512);
}
