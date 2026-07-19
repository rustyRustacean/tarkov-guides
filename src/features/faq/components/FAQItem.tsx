"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { Card } from "@/shared/ui/card/Card";

import type { ReactNode } from "react";

/**
 * A single collapsible FAQ question. Independent per-item state (not a
 * shared "only one open" accordion) - clicking a question just grows that
 * card in place, pushing later questions further down the page via normal
 * block flow, per the site's existing hand-rolled toggle convention
 * (`ItemLocationHint`, `AboutLink`) rather than pulling in an unstyled
 * Radix Accordion primitive for one page.
 */
export function FAQItem({ question, answer }: { question: string; answer: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <Card>
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => {
            setOpen((current) => !current);
          }}
          className="flex w-full items-center justify-between gap-4 p-6 text-left"
        >
          <span className="font-display text-base font-semibold">{question}</span>
          <ChevronDown
            aria-hidden="true"
            className={`text-muted-foreground size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      {open && (
        <div id={contentId} className="text-muted-foreground px-6 pb-6 text-sm leading-relaxed">
          {answer}
        </div>
      )}
    </Card>
  );
}
