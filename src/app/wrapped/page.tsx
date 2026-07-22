import { redirect } from "next/navigation";
import { currentKstMonth } from "@/lib/tastings/wrapped";

export default function WrappedIndex() {
  redirect(`/wrapped/${currentKstMonth()}`);
}
