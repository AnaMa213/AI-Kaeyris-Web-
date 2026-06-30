import type { components } from "@/types/api";

type Element = components["schemas"]["Element"];

/**
 * Read-only rendering of the Éléments card (BD-26): a flat `elements[]` list
 * grouped by free-form `category`, order-of-appearance preserved. Shared by the
 * GM panel (`ElementsArtifactPanel`) and the player read view (Story 8.4).
 */

function groupByCategory(
  items: Element[],
): Array<{ title: string; items: Element[] }> {
  const order: string[] = [];
  const groups = new Map<string, Element[]>();
  for (const el of items) {
    let bucket = groups.get(el.category);
    if (!bucket) {
      bucket = [];
      groups.set(el.category, bucket);
      order.push(el.category);
    }
    bucket.push(el);
  }
  return order.map((title) => ({ title, items: groups.get(title) ?? [] }));
}

function ElementGroup({ title, items }: { title: string; items: Element[] }) {
  return (
    <div>
      <h3 className="font-display text-text-chrome mb-1 text-sm font-semibold">
        {title}
      </h3>
      <ul className="text-text-chrome list-disc space-y-1 pl-5 text-sm">
        {items.map((el, index) => (
          <li key={`${el.name}-${index}`}>
            <span className="font-medium">{el.name}</span>
            {el.description ? (
              <span className="text-text-chrome-muted"> — {el.description}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ElementsView({ elements }: { elements: Element[] }) {
  const groups = groupByCategory(elements);
  if (groups.length === 0) {
    return (
      <p className="text-text-chrome-muted text-sm italic">Aucun élément.</p>
    );
  }
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <ElementGroup key={group.title} title={group.title} items={group.items} />
      ))}
    </div>
  );
}
