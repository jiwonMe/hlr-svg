import React from "react";
import * as Popover from "@radix-ui/react-popover";

type Obj = { id: string };

type ObjectSelectorProps = {
  primitives: readonly Obj[];
  selectedId: string | null;
  onChange: (next: string | null) => void;
};

export function ObjectSelector({ primitives, selectedId, onChange }: ObjectSelectorProps): React.ReactElement {
  const selectedLabel = selectedId ?? "없음";
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="btn" type="button" title="객체 선택">
          객체: {selectedLabel}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className="radixPopover" sideOffset={10} align="end">
          <div className="radixTitle">객체 선택</div>

          <div className="objList">
            <button className="objBtn" type="button" onClick={() => onChange(null)}>
              선택 해제
            </button>
            {primitives.map((p) => {
              const active = p.id === selectedId;
              return (
                <button
                  key={p.id}
                  className={active ? "objBtn objBtnActive" : "objBtn"}
                  type="button"
                  onClick={() => onChange(p.id)}
                >
                  {p.id}
                </button>
              );
            })}
          </div>

          <Popover.Arrow className="radixArrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}


