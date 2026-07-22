import path from "node:path";
import { config } from "dotenv";
config({ path: path.resolve(process.cwd(), ".env.local") });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data, error } = await supabase.from("currency_rates").select("*");
  console.log("rates:", data);
  if (error) console.error(error);
}

main();
