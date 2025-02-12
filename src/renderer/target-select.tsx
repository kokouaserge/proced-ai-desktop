import { SelectComponent, type SelectOption } from "./ui/select";

export function TargetSelect(props: {
  options: SelectOption[];
  onChange: (value: string) => void;
  value: string;
  selected: boolean;
  optionsEmptyText?: string;
  placeholder?: string;
}) {
  /*  createEffect(() => {
    const v = props.value;
    if (!v) return;

    if (!props.options.some((o) => o.id === v.id)) {
      props.onChange(props.options[0] ?? null);
    }
  }); */

  return (
    <div className=" w-full z-10">
      <SelectComponent
        options={props.options}
        onChange={() => console.log()}
        value={props.value}
        placeholder={props.placeholder}
        emptyMessage={props.optionsEmptyText}
      />
    </div>
  );
}
