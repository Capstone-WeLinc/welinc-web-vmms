import { useId, useState, type InputHTMLAttributes } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "list" | "onChange" | "value"> {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  onBlur,
  ...inputProps
}: SearchableSelectProps) {
  const generatedId = useId().replace(/:/g, "");
  const [query, setQuery] = useState<string | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const displayValue = query ?? selectedOption?.label ?? value;

  const findOption = (text: string) => {
    const normalized = text.trim().toLocaleLowerCase();
    return options.find(
      (option) =>
        option.label.trim().toLocaleLowerCase() === normalized ||
        option.value.trim().toLocaleLowerCase() === normalized,
    );
  };

  return (
    <>
      <input
        {...inputProps}
        list={`searchable-options-${generatedId}`}
        value={displayValue}
        autoComplete="off"
        aria-autocomplete="list"
        aria-invalid={
          query !== null && query.trim() !== "" && !findOption(query)
            ? true
            : inputProps["aria-invalid"]
        }
        onChange={(event) => {
          const text = event.target.value;
          const option = findOption(text);
          if (option) {
            setQuery(null);
            onChange(option.value);
          } else {
            setQuery(text);
            onChange("");
          }
        }}
        onBlur={(event) => {
          if (query !== null) {
            const option = findOption(query);
            setQuery(null);
            onChange(option?.value ?? "");
          }
          onBlur?.(event);
        }}
      />
      <datalist id={`searchable-options-${generatedId}`}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.label} />
        ))}
      </datalist>
    </>
  );
}
