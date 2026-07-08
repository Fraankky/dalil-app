interface Env {
  BACKEND_URL?: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env, params }) => {
  if (!env.BACKEND_URL) {
    return new Response(JSON.stringify({ error: "BACKEND_URL not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const path = (params.path as string[]).join("/");
  const url = new URL(`/api/${path}`, env.BACKEND_URL);
  url.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    redirect: "manual",
  };

  const upstream = await fetch(url.toString(), init);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  });
};