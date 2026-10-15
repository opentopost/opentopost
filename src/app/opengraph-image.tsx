import { OG_SIZE, renderOg } from "@/lib/og";
import { PAGES } from "@/lib/site";

export const alt = PAGES.home.heading;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOg("home");
}
