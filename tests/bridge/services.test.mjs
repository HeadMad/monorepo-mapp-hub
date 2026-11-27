import { test } from "node:test";
import assert from "node:assert/strict";
import { ServiceHost } from "../../apps/shell-mobile/www/js/bridge/services.js";

test("frameOf без основного iframe возвращает null", () => {
  const host = new ServiceHost({
    host: { className: "", style: {} },
    urlFor: () => "",
    main: () => ({ appId: null, iframe: null }),
    ensureInstalled: async () => {},
  });
  assert.equal(host.frameOf({}), null);
});
