import React from "react";
import * as Popover from "@radix-ui/react-popover";
import * as Slider from "@radix-ui/react-slider";
import * as ToggleGroup from "@radix-ui/react-toggle-group";

export type LineStyleState = {
  strokeVisible: string;
  strokeHidden: string;
  strokeWidthVisible: number;
  strokeWidthHidden: number;
  dashArrayHidden: string;
  opacityHidden: number;
  lineCap: "butt" | "round" | "square";
};

type StylePanelProps = {
  value: LineStyleState;
  onChange: (next: LineStyleState) => void;
};

export function StylePanel({ value, onChange }: StylePanelProps): React.ReactElement {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="btn" type="button" title="실선/점선 스타일">
          스타일
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className="radixPopover" sideOffset={10} align="end">
          <div className="radixTitle">라인 스타일</div>

          <div className="radixGrid">
            <div className="radixRow">
              <div className="radixLabel">실선 색</div>
              <input
                className="radixColor"
                type="color"
                value={value.strokeVisible}
                onChange={(e) => onChange({ ...value, strokeVisible: e.target.value })}
              />
            </div>

            <div className="radixRow">
              <div className="radixLabel">점선 색</div>
              <input
                className="radixColor"
                type="color"
                value={value.strokeHidden}
                onChange={(e) => onChange({ ...value, strokeHidden: e.target.value })}
              />
            </div>

            <div className="radixRow">
              <div className="radixLabel">실선 두께</div>
              <div className="radixValue">{value.strokeWidthVisible.toFixed(2)}</div>
            </div>
            <Slider.Root
              className="radixSlider"
              min={0.5}
              max={4.0}
              step={0.05}
              value={[value.strokeWidthVisible]}
              onValueChange={(v) =>
                onChange({ ...value, strokeWidthVisible: v[0] ?? value.strokeWidthVisible })
              }
              aria-label="실선 두께"
            >
              <Slider.Track className="radixSliderTrack">
                <Slider.Range className="radixSliderRange" />
              </Slider.Track>
              <Slider.Thumb className="radixSliderThumb" />
            </Slider.Root>

            <div className="radixRow">
              <div className="radixLabel">점선 두께</div>
              <div className="radixValue">{value.strokeWidthHidden.toFixed(2)}</div>
            </div>
            <Slider.Root
              className="radixSlider"
              min={0.5}
              max={4.0}
              step={0.05}
              value={[value.strokeWidthHidden]}
              onValueChange={(v) =>
                onChange({ ...value, strokeWidthHidden: v[0] ?? value.strokeWidthHidden })
              }
              aria-label="점선 두께"
            >
              <Slider.Track className="radixSliderTrack">
                <Slider.Range className="radixSliderRange" />
              </Slider.Track>
              <Slider.Thumb className="radixSliderThumb" />
            </Slider.Root>

            <div className="radixRow">
              <div className="radixLabel">점선 패턴</div>
              <input
                className="radixInput"
                value={value.dashArrayHidden}
                onChange={(e) => onChange({ ...value, dashArrayHidden: e.target.value })}
                placeholder='예: "4 4"'
              />
            </div>

            <div className="radixRow">
              <div className="radixLabel">점선 투명도</div>
              <div className="radixValue">{value.opacityHidden.toFixed(2)}</div>
            </div>
            <Slider.Root
              className="radixSlider"
              min={0.15}
              max={1.0}
              step={0.05}
              value={[value.opacityHidden]}
              onValueChange={(v) => onChange({ ...value, opacityHidden: v[0] ?? value.opacityHidden })}
              aria-label="점선 투명도"
            >
              <Slider.Track className="radixSliderTrack">
                <Slider.Range className="radixSliderRange" />
              </Slider.Track>
              <Slider.Thumb className="radixSliderThumb" />
            </Slider.Root>

            <div className="radixRow">
              <div className="radixLabel">linecap</div>
              <ToggleGroup.Root
                className="radixToggleGroup"
                type="single"
                value={value.lineCap}
                onValueChange={(v) => {
                  const next = (v || value.lineCap) as LineStyleState["lineCap"];
                  onChange({ ...value, lineCap: next });
                }}
                aria-label="linecap"
              >
                <ToggleGroup.Item className="radixToggleItem" value="butt">
                  butt
                </ToggleGroup.Item>
                <ToggleGroup.Item className="radixToggleItem" value="round">
                  round
                </ToggleGroup.Item>
                <ToggleGroup.Item className="radixToggleItem" value="square">
                  square
                </ToggleGroup.Item>
              </ToggleGroup.Root>
            </div>
          </div>

          <Popover.Arrow className="radixArrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}


