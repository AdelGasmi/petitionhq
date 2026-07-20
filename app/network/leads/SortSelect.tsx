"use client";

import { useRouter } from "next/navigation";

type Props = { value: string; baseUrl: string };

export function SortSelect({ value, baseUrl }: Props) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const sort = e.target.value;
    const url = sort === "newest" ? baseUrl : `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}sort=${sort}`;
    router.push(url);
  }

  return (
    <select
      className="select text-sm w-auto shrink-0"
      value={value}
      onChange={handleChange}
      aria-label="Sort leads"
    >
      <option value="newest">Newest first</option>
      <option value="score">Highest score</option>
      <option value="trust">Highest trust</option>
    </select>
  );
}
