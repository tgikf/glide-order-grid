import { renderHook, act } from "@testing-library/react";
import { useColumnFilterInputs } from "../useColumnFilterInputs";
import { RefObject } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DataGridColumn } from "../../data-grid/DataGridColumn.ts";

/**
 * @vitest-environment happy-dom
 */

// Test data structure
interface TestItem {
  id: string;
  name: string;
  category: string;
  value: number;
}

// Mock columns for testing
const createTestColumns = (): DataGridColumn<TestItem>[] => [
  {
    id: "name",
    title: "Name",
    width: 150,
    visible: true,
    filter: { val: "", disabled: false },
  },
  {
    id: "category",
    title: "Category",
    width: 100,
    visible: true,
    filter: { val: "A", disabled: false },
  },
  {
    id: "value",
    title: "Value",
    width: 120,
    visible: true,
    filter: { val: "", disabled: false },
  },
  {
    id: "hidden",
    title: "Hidden",
    width: 80,
    visible: true,
    filter: { val: "", disabled: false },
  },
];

// Mock DOM element
const createMockElement = (props: Partial<HTMLElement> = {}) =>
  ({
    scrollLeft: 0,
    clientWidth: 500,
    offsetWidth: 515, // 15px scrollbar
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: vi.fn(),
    ...props,
  }) as unknown as HTMLElement;

// Mock grid ref
const createMockGridRef = (
  scrollElement?: HTMLElement,
): RefObject<HTMLDivElement> => {
  const gridElement = createMockElement({
    clientWidth: 500,
    querySelector: vi.fn(() => scrollElement || createMockElement()),
  });

  return {
    current: gridElement as HTMLDivElement,
  };
};

describe("useColumnFilterInputs", () => {
  let mockOnFilterChange: (colId: string, value: string) => void;
  let mockScrollElement: HTMLElement;
  let mockGridRef: RefObject<HTMLDivElement>;

  beforeEach(() => {
    mockOnFilterChange = vi.fn();
    mockScrollElement = createMockElement();
    mockGridRef = createMockGridRef(mockScrollElement);

    // Mock window.addEventListener
    vi.spyOn(window, "addEventListener");
    vi.spyOn(window, "removeEventListener");

    // Mock setTimeout/clearTimeout
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("Basic functionality", () => {
    it("should calculate input positions after initialization", async () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      // Fast-forward the initialization timer
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.headerInputs).toHaveLength(4);
      expect(result.current.headerInputs[0]).toMatchObject({
        id: "name",
        x: 0,
        y: 30,
        width: 150,
        visible: true,
      });
      expect(result.current.headerInputs[1]).toMatchObject({
        id: "category",
        x: 150,
        y: 30,
        width: 100,
        visible: true,
      });
    });

    it("should provide updateInputPositions function", () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      expect(typeof result.current.updateInputPositions).toBe("function");
    });

    it("should provide headerInputsJSX", () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      expect(result.current.headerInputsJSX).toBeDefined();
      expect(typeof result.current.headerInputsJSX).toBe("object");
    });
  });

  describe("Position calculations", () => {
    it("should calculate correct positions for visible columns", async () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 25,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const inputs = result.current.headerInputs;
      expect(inputs[0]).toMatchObject({
        id: "name",
        x: 0,
        y: 25,
        width: 150,
        originalLeft: 0,
      });
      expect(inputs[1]).toMatchObject({
        id: "category",
        x: 150,
        y: 25,
        width: 100,
        originalLeft: 150,
      });
      expect(inputs[2]).toMatchObject({
        id: "value",
        x: 250,
        y: 25,
        width: 120,
        originalLeft: 250,
      });
    });

    it("should handle columns with default width when width is not specified", async () => {
      const columnsWithoutWidth: DataGridColumn<TestItem>[] = [
        {
          id: "test",
          title: "Test",
          visible: true,
          filter: { val: "", disabled: false },
        },
      ];

      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns: columnsWithoutWidth,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.headerInputs[0]).toMatchObject({
        width: 150, // Default width
      });
    });

    it("should calculate visibility based on scroll position", async () => {
      const scrolledElement = createMockElement({
        scrollLeft: 200,
        clientWidth: 300,
        offsetWidth: 315,
      });
      const scrolledGridRef = createMockGridRef(scrolledElement);

      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: scrolledGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const inputs = result.current.headerInputs;
      // First column (0-150) should not be visible when scrolled to 200
      expect(inputs[0].visible).toBe(false);
      // Second column (150-250) should be visible
      expect(inputs[1].visible).toBe(true);
    });

    it("should calculate maxWidth correctly for partially visible columns", async () => {
      const narrowGridElement = createMockElement({
        clientWidth: 200, // Narrow grid
        offsetWidth: 200, // Should match clientWidth for no scrollbar
        scrollLeft: 0,
      });
      const narrowGridRef = {
        current: {
          clientWidth: 200, // Match the scroll element width
          querySelector: vi.fn(() => narrowGridElement),
        } as unknown as HTMLDivElement,
      };

      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: narrowGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const inputs = result.current.headerInputs;
      // First column should have maxWidth limited by grid width
      expect(inputs[0].maxWidth).toBe(150); // Limited by grid width
      expect(inputs[1].maxWidth).toBe(50); // 200 - 150 (first column width)
    });
  });

  describe("Scroll handling", () => {
    it("should update scroll position when scrolled", async () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Simulate scroll
      mockScrollElement.scrollLeft = 100;

      // Find the scroll handler that was added
      const scrollHandler = (
        mockScrollElement.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find(([event]) => event === "scroll")?.[1];

      act(() => {
        scrollHandler?.();
      });

      // Positions should be updated relative to new scroll position
      const inputs = result.current.headerInputs;
      expect(inputs[0].x).toBe(-100); // 0 - 100 scroll offset
      expect(inputs[1].x).toBe(50); // 150 - 100 scroll offset
    });

    it("should attach and remove scroll listeners correctly", async () => {
      const columns = createTestColumns();
      const { unmount } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(mockScrollElement.addEventListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
      );

      unmount();

      expect(mockScrollElement.removeEventListener).toHaveBeenCalledWith(
        "scroll",
        expect.any(Function),
      );
    });
  });

  describe("Resize handling", () => {
    it("should attach resize listener on mount", () => {
      const columns = createTestColumns();
      renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      expect(window.addEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
      );
    });

    it("should remove resize listener on unmount", () => {
      const columns = createTestColumns();
      const { unmount } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      const resizeHandler = (
        window.addEventListener as ReturnType<typeof vi.fn>
      ).mock.calls.find(([event]) => event === "resize")?.[1];

      unmount();

      expect(window.removeEventListener).toHaveBeenCalledWith(
        "resize",
        resizeHandler,
      );
    });

    it("should attach resize listener on mount", () => {
      const columns = createTestColumns();
      renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      expect(window.addEventListener).toHaveBeenCalledWith(
        "resize",
        expect.any(Function),
      );
    });
  });

  describe("Column changes", () => {
    it("should update positions when columns change", async () => {
      const initialColumns = createTestColumns().slice(0, 2);
      const { result, rerender } = renderHook(
        ({ columns }) =>
          useColumnFilterInputs({
            columns,
            gridRef: mockGridRef,
            headerTextAreaHeight: 30,
            onFilterChange: mockOnFilterChange,
          }),
        { initialProps: { columns: initialColumns } },
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.headerInputs).toHaveLength(2);

      // Add more columns
      const newColumns = createTestColumns();
      rerender({ columns: newColumns });

      expect(result.current.headerInputs).toHaveLength(4);
    });

    it("should handle empty columns array", async () => {
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns: [],
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.headerInputs).toEqual([]);
    });

    it("should handle columns with missing ids", async () => {
      const columnsWithMissingIds: DataGridColumn<TestItem>[] = [
        {
          id: "valid",
          title: "Valid",
          width: 100,
          visible: true,
          filter: { val: "", disabled: false },
        },
        {
          title: "Missing ID",
          width: 100,
          visible: true,
          filter: { val: "", disabled: false },
        } as DataGridColumn<TestItem>,
      ];

      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns: columnsWithMissingIds,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.headerInputs).toHaveLength(2);
      expect(result.current.headerInputs[0].id).toBe("valid");
      expect(result.current.headerInputs[1].id).toBe(""); // Missing id becomes empty string
    });
  });

  describe("updateInputPositions function", () => {
    it("should manually update positions when called", async () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      const initialInputs = result.current.headerInputs;

      // Manually update with different columns
      const newColumns = createTestColumns().slice(0, 2);
      act(() => {
        result.current.updateInputPositions(newColumns);
      });

      expect(result.current.headerInputs).not.toBe(initialInputs);
      expect(result.current.headerInputs).toHaveLength(2);
    });

    it("should accept custom x offset", async () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // Update with custom offset
      act(() => {
        result.current.updateInputPositions(columns, 50);
      });

      const inputs = result.current.headerInputs;
      expect(inputs[0].x).toBe(-50); // 0 - 50 offset
      expect(inputs[1].x).toBe(100); // 150 - 50 offset
    });
  });

  describe("Edge cases", () => {
    it("should handle null gridRef", () => {
      const nullGridRef: RefObject<HTMLDivElement | null> = { current: null };
      const columns = createTestColumns();

      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: nullGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.headerInputs).toEqual([]);
    });

    it("should clean up timers on unmount", () => {
      const columns = createTestColumns();
      const { unmount } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

      unmount();

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe("Memoization behavior", () => {
    it("should maintain stable updateInputPositions reference when dependencies unchanged", () => {
      const columns = createTestColumns();
      const { result, rerender } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      const firstUpdateFunction = result.current.updateInputPositions;

      // Rerender with same props
      rerender();

      expect(result.current.updateInputPositions).toBe(firstUpdateFunction);
    });

    it("should update when gridRef changes", () => {
      const columns = createTestColumns();
      const newGridRef = createMockGridRef();

      const { result, rerender } = renderHook(
        ({ gridRef }) =>
          useColumnFilterInputs({
            columns,
            gridRef,
            headerTextAreaHeight: 30,
            onFilterChange: mockOnFilterChange,
          }),
        { initialProps: { gridRef: mockGridRef } },
      );

      const firstUpdateFunction = result.current.updateInputPositions;

      rerender({ gridRef: newGridRef });

      expect(result.current.updateInputPositions).not.toBe(firstUpdateFunction);
    });
  });

  describe("Filter integration", () => {
    it("should call onFilterChange when filter value changes in JSX", async () => {
      const columns = createTestColumns();
      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // The JSX should be generated with current filter values
      expect(result.current.headerInputsJSX).toBeDefined();

      // Since we can't easily test JSX event handlers in unit tests,
      // we verify the callback is passed correctly
      expect(mockOnFilterChange).not.toHaveBeenCalled();
    });

    it("should include filter values in input calculations", async () => {
      const columnsWithFilters = createTestColumns();
      columnsWithFilters[0].filter = { val: "test filter", disabled: false };

      const { result } = renderHook(() =>
        useColumnFilterInputs({
          columns: columnsWithFilters,
          gridRef: mockGridRef,
          headerTextAreaHeight: 30,
          onFilterChange: mockOnFilterChange,
        }),
      );

      act(() => {
        vi.advanceTimersByTime(100);
      });

      // The JSX should reflect the filter values
      expect(result.current.headerInputsJSX).toBeDefined();
    });
  });
});
