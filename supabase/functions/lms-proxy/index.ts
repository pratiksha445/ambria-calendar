import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LMS_ENDPOINTS: Record<string, string> = {
  venue:
    "https://gyv.inqcrm.in/api/v1/processerp_api/get_venue_contract_information_list",
  catering:
    "https://gyv.inqcrm.in/api/v1/processerp_api/get_catering_contract_information_list",
  decor:
    "https://gyv.inqcrm.in/api/v1/processerp_api/get_decor_contract_information_list",
  entertainment:
    "https://gyv.inqcrm.in/api/v1/processerp_api/get_entertain_contract_information_list",
};

const DATE_FIELDS: Record<string, string> = {
  venue: "fiscd_function_date",
  catering: "chcd_date",
  decor: "dhcd_date",
  entertainment: "ehcd_date",
};

const CANCEL_FIELDS: Record<string, string> = {
  venue: "fisc_cancel_remarks",
  catering: "chc_cancel_remarks",
  decor: "dhc_cancel_remarks",
  entertainment: "ehc_cancel_remarks",
};

function buildRequestBody(
  department: string,
  pageLimit: number
): Record<string, string> {
  const base = { loggeduserid: "1", page_limit: String(pageLimit) };
  const empty = (keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, ""]));

  switch (department) {
    case "venue":
      return {
        ...base,
        ...empty([
          "fromdate",
          "uptodated",
          "search_venue_contract",
          "priority_search",
          "venue_datetype",
          "source_search",
          "venue_search",
          "balance_pending",
          "contract_venue_search",
          "contract_assginee_search",
          "leadtype_search",
          "report_fac",
        ]),
      };
    case "catering":
      return {
        ...base,
        ...empty([
          "fromdate",
          "uptodated",
          "search_catering_contract",
          "priority_search",
          "cater_datetype",
          "source_search",
          "balance_pending",
          "contract_catering_search",
          "contract_assginee_search",
          "leadtype_search",
          "report_fac",
        ]),
      };
    case "decor":
      return {
        ...base,
        ...empty([
          "fromdate",
          "uptodated",
          "entertain_search",
          "source_search",
          "lead_type_search",
          "entertain_venue_search",
          "priority_search",
          "entertain_assginee_search",
          "entertain_status_search",
          "search_date_type",
          "visited_search",
          "follow_dated",
        ]),
      };
    case "entertainment":
      return {
        ...base,
        ...empty([
          "fromdate",
          "uptodated",
          "search_entertain_contract",
          "source_search",
          "contract_venue_searche",
          "balance_pending",
          "contract_assginee_search",
          "entertain_datetype",
          "leadtype_search",
          "report_fac",
        ]),
      };
    default:
      return base;
  }
}

function parseDate(dateStr: string): Date | null {
  const d = new Date(dateStr + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { department, from_date, to_date } = await req.json();

    if (!department || !LMS_ENDPOINTS[department]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid department. Must be one of: ${Object.keys(LMS_ENDPOINTS).join(", ")}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const endpoint = LMS_ENDPOINTS[department];
    const dateField = DATE_FIELDS[department];
    const cancelField = CANCEL_FIELDS[department];
    const allContracts: Record<string, unknown>[] = [];
    let warning: string | undefined;
    const MAX_PAGES = 50;

    for (let page = 1; page <= MAX_PAGES; page++) {
      const body = buildRequestBody(department, page);

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
          warning = `LMS returned HTTP ${res.status} on page ${page}. Returning ${allContracts.length} records collected so far.`;
          break;
        }

        const data = await res.json();
        const contracts: Record<string, unknown>[] = data?.Contractinfo ?? [];

        if (contracts.length === 0) {
          break;
        }

        allContracts.push(...contracts);

        if (contracts.length < 10) {
          break;
        }
      } catch (err) {
        warning = `Failed on page ${page}: ${err instanceof Error ? err.message : String(err)}. Returning ${allContracts.length} records collected so far.`;
        break;
      }
    }

    // Filter out cancelled contracts (cancel_remarks non-empty after trim = cancelled)
    const active = allContracts.filter((c) => {
      const cancelValue = c[cancelField];
      if (cancelValue != null && String(cancelValue).trim() !== "") return false;
      return true;
    });

    // Apply date filtering if from_date/to_date provided
    let filtered = active;
    if (from_date || to_date) {
      const fromD = from_date ? parseDate(from_date) : null;
      const toD = to_date ? parseDate(to_date) : null;

      filtered = active.filter((c) => {
        const raw = c[dateField];
        if (!raw || typeof raw !== "string") return false;
        const d = parseDate(raw);
        if (!d) return false;
        if (fromD && d < fromD) return false;
        if (toD && d > toD) return false;
        return true;
      });
    }

    const result: Record<string, unknown> = {
      success: true,
      department,
      total: filtered.length,
      contracts: filtered,
    };
    if (warning) {
      result.warning = warning;
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
