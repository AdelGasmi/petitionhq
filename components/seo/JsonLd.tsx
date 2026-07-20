/**
 * Inline a JSON-LD <script> block.
 *
 * Pass any schema.org-compliant object. Output is rendered as a serialized
 * application/ld+json script in the document head/body. Renders nothing if
 * data is null/undefined.
 */
export function JsonLd({ data }: { data: unknown }) {
  if (!data) return null;
  return (
    <script
      type="application/ld+json"
      // JSON.stringify with replacer prevents </script> injection by escaping the slash.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
