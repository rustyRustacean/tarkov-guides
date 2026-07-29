import { describe, expect, it } from "vitest";

import { applyTranslations } from "./apply-translations";

describe("applyTranslations", () => {
  it("replaces string values at the given JSONPath locations using the dictionary", () => {
    const envelope = {
      data: {
        items: {
          "item-1": { id: "item-1", name: "item-1 Name", shortName: "item-1 ShortName" },
        },
      },
    };

    const result = applyTranslations(
      envelope,
      ["$.data.items.*.name", "$.data.items.*.shortName"],
      { "item-1 Name": "LEDX Skin Transilluminator", "item-1 ShortName": "LEDX" },
    );

    expect(result.data.items["item-1"]).toEqual({
      id: "item-1",
      name: "LEDX Skin Transilluminator",
      shortName: "LEDX",
    });
  });

  it("leaves a value untranslated when the dictionary has no matching key", () => {
    const envelope = { data: { items: { "item-1": { name: "item-1 Name" } } } };

    const result = applyTranslations(envelope, ["$.data.items.*.name"], {});

    expect(result.data.items["item-1"].name).toBe("item-1 Name");
  });

  it("does not touch fields outside the given paths, even when their value coincidentally equals a translation key", () => {
    // Regression test for a real case found on the live API: an objective's
    // `id` and `description` can hold the identical placeholder string
    // pre-translation. Only `description` is a listed translation path, so
    // `id` must survive untouched even though it's also a key in `dict`.
    const envelope = {
      data: {
        tasks: {
          "task-1": {
            objectives: [{ id: "obj-key-1", description: "obj-key-1" }],
          },
        },
      },
    };

    const result = applyTranslations(envelope, ["$.data.tasks.*.objectives[*].description"], {
      "obj-key-1": "Hand over the syringe",
    });

    const objective = result.data.tasks["task-1"].objectives[0];
    expect(objective?.description).toBe("Hand over the syringe");
    expect(objective?.id).toBe("obj-key-1");
  });

  it("resolves wildcard array paths across every matching entry", () => {
    const envelope = {
      data: {
        tasks: {
          "task-1": { objectives: [{ description: "key-a" }, { description: "key-b" }] },
          "task-2": { objectives: [{ description: "key-c" }] },
        },
      },
    };

    const result = applyTranslations(envelope, ["$.data.tasks.*.objectives[*].description"], {
      "key-a": "Find the item",
      "key-b": "Hand over the item",
      "key-c": "Extract with the item",
    });

    expect(result.data.tasks["task-1"].objectives.map((o) => o.description)).toEqual([
      "Find the item",
      "Hand over the item",
    ]);
    expect(result.data.tasks["task-2"].objectives[0]?.description).toBe("Extract with the item");
  });
});
