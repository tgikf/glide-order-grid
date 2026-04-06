import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
  RefObject,
  ReactElement,
} from "react";
import { DataGridColumn } from "../data-grid/DataGridColumn.ts";
import { Filter } from "lucide-react";
import clsx from "clsx";

interface UseColumnFilterInputsParams<T> {
  columns: DataGridColumn<T>[];
  gridRef: RefObject<HTMLDivElement | null>;
  headerTextAreaHeight: number;
  onFilterChange: (colId: string, value: string) => void;
}

interface HeaderInput {
  id: string;
  x: number;
  y: number;
  width: number;
  maxWidth: number;
  visible: boolean;
  originalLeft: number;
}

interface UseColumnFilterInputsReturn {
  headerInputs: HeaderInput[];
  updateInputPositions: (
    newColumns: DataGridColumn<any>[],
    xOffset?: number,
  ) => void;
  headerInputsJSX: ReactElement;
}

export function useColumnFilterInputs<T>({
  columns,
  gridRef,
  headerTextAreaHeight,
  onFilterChange,
}: UseColumnFilterInputsParams<T>): UseColumnFilterInputsReturn {
  const [headerInputs, setHeaderInputs] = useState<HeaderInput[]>([]);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);

  const calculateInputPositions = useCallback(
    (
      columnsToCalculate: DataGridColumn<T>[],
      xOffset?: number,
    ): HeaderInput[] => {
      if (!gridRef.current || !columnsToCalculate.length) return [];

      const gridWidth = gridRef.current.clientWidth - scrollbarWidth;
      const offset = xOffset !== undefined ? xOffset : scrollLeft;
      let absoluteLeft = 0;

      return columnsToCalculate.map((column) => {
        const colWidth = column.width || 150;
        const absoluteX = absoluteLeft;
        const inputRight = absoluteX + colWidth;
        const scrollRight = offset + gridWidth;

        // Column is at least partially visible
        const isVisible = absoluteX < scrollRight && inputRight > offset;

        // Calculate position relative to the viewport
        // This might be negative if the column is partially off-screen to the left
        const relativeX = absoluteX - offset;

        const input: HeaderInput = {
          id: column.id ?? "",
          x: relativeX, // This can be negative for partially visible left columns
          y: headerTextAreaHeight,
          width: colWidth, // Always use full column width
          maxWidth: Math.min(colWidth, gridWidth - relativeX),
          visible: isVisible,
          originalLeft: absoluteX, // Store original position for reference
        };

        absoluteLeft += colWidth;
        return input;
      });
    },
    [gridRef, scrollbarWidth, scrollLeft, headerTextAreaHeight],
  );

  const handleScroll = useCallback(() => {
    const scrollElement = gridRef.current?.querySelector(".dvn-scroller");
    if (scrollElement) {
      setScrollLeft(scrollElement.scrollLeft);
    }
  }, [gridRef]);

  const updateInputPositions = useCallback(
    (newColumns: DataGridColumn<any>[], xOffset?: number) => {
      const newInputs = calculateInputPositions(newColumns, xOffset);
      if (newInputs.length > 0) {
        setHeaderInputs(newInputs);
      }
    },
    [calculateInputPositions],
  );

  // Initial setup and scroll listener attachment
  useEffect(() => {
    if (!gridRef.current) return;

    // Slightly delayed to ensure grid is fully rendered
    const initTimer = setTimeout(() => {
      const scrollElement =
        gridRef.current?.querySelector<HTMLElement>(".dvn-scroller");
      if (scrollElement) {
        const width = scrollElement.offsetWidth - scrollElement.clientWidth;
        setScrollbarWidth(width);
        setScrollLeft(scrollElement.scrollLeft);
        scrollElement.addEventListener("scroll", handleScroll);
      }
    }, 100);

    return () => {
      clearTimeout(initTimer);
      const scrollElement = gridRef.current?.querySelector(".dvn-scroller");
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll);
      }
    };
  }, [gridRef, handleScroll]);

  // Update scroll listener when handleScroll changes
  useEffect(() => {
    const scrollElement = gridRef.current?.querySelector(".dvn-scroller");
    if (scrollElement) {
      scrollElement.removeEventListener("scroll", handleScroll);
      scrollElement.addEventListener("scroll", handleScroll);
    }

    return () => {
      if (scrollElement) {
        scrollElement.removeEventListener("scroll", handleScroll);
      }
    };
  }, [handleScroll, gridRef]);

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      const scrollElement =
        gridRef.current?.querySelector<HTMLElement>(".dvn-scroller");
      if (scrollElement) {
        const newScrollbarWidth =
          scrollElement.offsetWidth - scrollElement.clientWidth;
        setScrollbarWidth(newScrollbarWidth);
        setScrollLeft(scrollElement.scrollLeft);
        const newInputs = calculateInputPositions(
          columns,
          scrollElement.scrollLeft,
        );
        if (newInputs.length > 0) {
          setHeaderInputs(newInputs);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [columns, calculateInputPositions, gridRef]);

  // Update input positions when columns change
  useLayoutEffect(() => {
    const newInputs = calculateInputPositions(columns);
    if (newInputs.length > 0) {
      setHeaderInputs(newInputs);
    }
  }, [calculateInputPositions, columns]);

  const headerInputsJSX = (
    <>
      {headerInputs
        .filter((input) => input.visible)
        .map((input) => {
          const actualWidth = Math.min(input.maxWidth, input.width) - 8;
          const isHidden = actualWidth < 26;
          const isTrimmed = actualWidth < input.width - 8;
          const filter = columns.find((e) => e.id === input.id)?.filter ?? {
            val: "",
            disabled: false,
          };

          return (
            <div
              key={`filter-wrapper-${input.id}`}
              className="absolute flex items-center overflow-hidden h-[25px]"
              style={{
                top: input.y + 3,
                left: input.x + 4,
                width: actualWidth,
                display: isHidden ? "none" : undefined,
              }}
            >
              <input
                type="text"
                value={filter.val}
                disabled={filter.disabled}
                onChange={(e) => onFilterChange(input.id, e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                placeholder=""
                className={clsx(
                  "size-full text-sm rounded-sm pl-[26px] pr-[4px]",
                  "border box-border outline-none border-border",
                  "bg-background hover:bg-background-hover disabled:color",
                  {
                    "border-r-0": isTrimmed,
                    "opacity-75": filter.disabled,
                  },
                )}
              />
              <div
                className={clsx(
                  "absolute left-1 flex items-center justify-center pointer-events-none",
                  {
                    "text-secondary": filter.val,
                    "text-foreground2": !filter.val,
                    "opacity-75": filter.disabled,
                  },
                )}
                style={{ display: isHidden ? "none" : undefined }}
              >
                <Filter size={16} />
              </div>
            </div>
          );
        })}
    </>
  );

  return {
    headerInputs,
    updateInputPositions,
    headerInputsJSX,
  };
}
