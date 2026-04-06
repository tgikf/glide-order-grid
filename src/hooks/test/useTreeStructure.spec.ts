import { renderHook } from "@testing-library/react";
import { TreeGridConfig, useTreeStructure } from "../useTreeStructure";
import { describe, it, expect, beforeEach } from "vitest";

/**
 * @vitest-environment happy-dom
 */

// Test data structure
interface TestItem {
  id: string;
  name: string;
  depth: number;
  childIds: string[];
  parentId?: string;
}

const mockTreeConfig: TreeGridConfig = {
  isTreeGrid: true,
  depthAccessor: "depth",
  childIdsAccessor: "childIds",
  treeColumnKey: "name",
};

const createTestData = (): TestItem[] => [
  // Root items (depth 0)
  { id: "root1", name: "Root 1", depth: 0, childIds: ["child1", "child2"] },
  { id: "root2", name: "Root 2", depth: 0, childIds: ["child3"] },
  { id: "root3", name: "Root 3", depth: 0, childIds: [] }, // No children

  // Level 1 items (depth 1)
  {
    id: "child1",
    name: "Child 1",
    depth: 1,
    childIds: ["grandchild1", "grandchild2"],
  },
  { id: "child2", name: "Child 2", depth: 1, childIds: [] }, // No children
  { id: "child3", name: "Child 3", depth: 1, childIds: ["grandchild3"] },

  // Level 2 items (depth 2)
  { id: "grandchild1", name: "Grandchild 1", depth: 2, childIds: [] },
  {
    id: "grandchild2",
    name: "Grandchild 2",
    depth: 2,
    childIds: ["greatgrandchild1"],
  },
  { id: "grandchild3", name: "Grandchild 3", depth: 2, childIds: [] },

  // Level 3 items (depth 3)
  {
    id: "greatgrandchild1",
    name: "Great Grandchild 1",
    depth: 3,
    childIds: [],
  },
];

describe("useTreeStructure", () => {
  describe("Basic functionality", () => {
    it("should return null when no tree config is provided", () => {
      const testData = createTestData();
      const { result } = renderHook(() =>
        useTreeStructure(testData, "id", undefined),
      );

      expect(result.current).toBeNull();
    });

    it("should handle empty data array", () => {
      const { result } = renderHook(() =>
        useTreeStructure([], "id", mockTreeConfig),
      );

      expect(result.current).not.toBeNull();
      expect(result.current!.itemsById.size).toBe(0);
      expect(result.current!.parentMap.size).toBe(0);
      expect(result.current!.childrenByParentId.size).toBe(0);
      expect(result.current!.rootItemIds).toEqual([]);
      expect(result.current!.rootIdByItemId.size).toBe(0);
    });

    it("should build tree structure correctly", () => {
      const testData = createTestData();
      const { result } = renderHook(() =>
        useTreeStructure(testData, "id", mockTreeConfig),
      );

      const structure = result.current!;

      // Check itemsById
      expect(structure.itemsById.size).toBe(10);
      expect(structure.itemsById.get("root1")?.name).toBe("Root 1");
      expect(structure.itemsById.get("grandchild1")?.name).toBe("Grandchild 1");

      // Check rootItemIds
      expect(structure.rootItemIds).toEqual(["root1", "root2", "root3"]);

      // Check parentMap
      expect(structure.parentMap.get("child1")).toBe("root1");
      expect(structure.parentMap.get("child2")).toBe("root1");
      expect(structure.parentMap.get("child3")).toBe("root2");
      expect(structure.parentMap.get("grandchild1")).toBe("child1");
      expect(structure.parentMap.get("greatgrandchild1")).toBe("grandchild2");

      // Check childrenByParentId
      expect(structure.childrenByParentId.get("root1")).toEqual([
        "child1",
        "child2",
      ]);
      expect(structure.childrenByParentId.get("child1")).toEqual([
        "grandchild1",
        "grandchild2",
      ]);
      expect(structure.childrenByParentId.get("root3")).toBeUndefined();

      // Check rootIdByItemId is present
      expect(structure.rootIdByItemId).toBeDefined();
      expect(structure.rootIdByItemId.size).toBe(10);
    });
  });

  describe("rootIdByItemId mapping", () => {
    let structure: ReturnType<typeof useTreeStructure>;

    beforeEach(() => {
      const testData = createTestData();
      const { result } = renderHook(() =>
        useTreeStructure(testData, "id", mockTreeConfig),
      );
      structure = result.current;
    });

    it("should map root items to themselves", () => {
      expect(structure!.rootIdByItemId.get("root1")).toBe("root1");
      expect(structure!.rootIdByItemId.get("root2")).toBe("root2");
      expect(structure!.rootIdByItemId.get("root3")).toBe("root3");
    });

    it("should map direct children to their root ancestors", () => {
      expect(structure!.rootIdByItemId.get("child1")).toBe("root1");
      expect(structure!.rootIdByItemId.get("child2")).toBe("root1");
      expect(structure!.rootIdByItemId.get("child3")).toBe("root2");
    });

    it("should map grandchildren to their root ancestors", () => {
      expect(structure!.rootIdByItemId.get("grandchild1")).toBe("root1");
      expect(structure!.rootIdByItemId.get("grandchild2")).toBe("root1");
      expect(structure!.rootIdByItemId.get("grandchild3")).toBe("root2");
    });

    it("should map deep descendants to their root ancestors", () => {
      expect(structure!.rootIdByItemId.get("greatgrandchild1")).toBe("root1");
    });

    it("should handle items with no parent correctly", () => {
      // Root items should still map to themselves
      expect(structure!.rootIdByItemId.get("root1")).toBe("root1");
      expect(structure!.rootIdByItemId.get("root2")).toBe("root2");
      expect(structure!.rootIdByItemId.get("root3")).toBe("root3");
    });

    it("should map all items in the structure", () => {
      const testData = createTestData();

      // Every item should have a root mapping
      for (const item of testData) {
        expect(structure!.rootIdByItemId.has(item.id)).toBe(true);
        const rootId = structure!.rootIdByItemId.get(item.id);
        expect(rootId).toBeDefined();

        // The root ID should be one of the known root IDs
        expect(["root1", "root2", "root3"]).toContain(rootId);
      }
    });

    it("should return undefined for non-existent items", () => {
      expect(structure!.rootIdByItemId.get("non-existent")).toBeUndefined();
    });
  });

  describe("Helper functions", () => {
    let structure: ReturnType<typeof useTreeStructure>;

    beforeEach(() => {
      const testData = createTestData();
      const { result } = renderHook(() =>
        useTreeStructure(testData, "id", mockTreeConfig),
      );
      structure = result.current;
    });

    describe("hasChildren", () => {
      it("should return true for items with children", () => {
        expect(structure!.hasChildren("root1")).toBe(true);
        expect(structure!.hasChildren("child1")).toBe(true);
        expect(structure!.hasChildren("grandchild2")).toBe(true);
      });

      it("should return false for items without children", () => {
        expect(structure!.hasChildren("root3")).toBe(false);
        expect(structure!.hasChildren("child2")).toBe(false);
        expect(structure!.hasChildren("grandchild1")).toBe(false);
        expect(structure!.hasChildren("greatgrandchild1")).toBe(false);
      });

      it("should return false for non-existent items", () => {
        expect(structure!.hasChildren("non-existent")).toBe(false);
      });
    });

    describe("getAncestors", () => {
      it("should return empty array for root items", () => {
        expect(structure!.getAncestors("root1")).toEqual([]);
        expect(structure!.getAncestors("root2")).toEqual([]);
      });

      it("should return direct parent for level 1 items", () => {
        expect(structure!.getAncestors("child1")).toEqual(["root1"]);
        expect(structure!.getAncestors("child3")).toEqual(["root2"]);
      });

      it("should return full ancestor chain for deep items", () => {
        expect(structure!.getAncestors("grandchild1")).toEqual([
          "child1",
          "root1",
        ]);
        expect(structure!.getAncestors("greatgrandchild1")).toEqual([
          "grandchild2",
          "child1",
          "root1",
        ]);
      });

      it("should return empty array for non-existent items", () => {
        expect(structure!.getAncestors("non-existent")).toEqual([]);
      });
    });

    describe("getDescendants", () => {
      it("should return empty array for leaf items", () => {
        expect(structure!.getDescendants("child2")).toEqual([]);
        expect(structure!.getDescendants("grandchild1")).toEqual([]);
        expect(structure!.getDescendants("greatgrandchild1")).toEqual([]);
      });

      it("should return direct children for items with only direct children", () => {
        expect(structure!.getDescendants("root3")).toEqual([]);
        expect(structure!.getDescendants("grandchild3")).toEqual([]);
      });

      it("should return all descendants recursively", () => {
        const root1Descendants = structure!.getDescendants("root1");
        expect(root1Descendants).toEqual([
          "child1",
          "grandchild1",
          "grandchild2",
          "greatgrandchild1",
          "child2",
        ]);

        const child1Descendants = structure!.getDescendants("child1");
        expect(child1Descendants).toEqual([
          "grandchild1",
          "grandchild2",
          "greatgrandchild1",
        ]);

        const grandchild2Descendants = structure!.getDescendants("grandchild2");
        expect(grandchild2Descendants).toEqual(["greatgrandchild1"]);
      });

      it("should return empty array for non-existent items", () => {
        expect(structure!.getDescendants("non-existent")).toEqual([]);
      });
    });
  });

  describe("Memoization behavior", () => {
    it("should not recalculate when data reference is the same", () => {
      const testData = createTestData();
      const { result, rerender } = renderHook(
        ({ data, config }) => useTreeStructure(data, "id", config),
        {
          initialProps: { data: testData, config: mockTreeConfig },
        },
      );

      const firstResult = result.current;

      // Rerender with same data reference
      rerender({ data: testData, config: mockTreeConfig });

      // Should be the same object reference (memoized)
      expect(result.current).toStrictEqual(firstResult);
    });

    it("should recalculate when data changes", () => {
      const testData1 = createTestData();
      const testData2 = [
        ...createTestData(),
        { id: "new-root", name: "New Root", depth: 0, childIds: [] },
      ];

      const { result, rerender } = renderHook(
        ({ data, config }) => useTreeStructure(data, "id", config),
        {
          initialProps: { data: testData1, config: mockTreeConfig },
        },
      );

      const firstResult = result.current;

      // Rerender with different data
      rerender({ data: testData2, config: mockTreeConfig });

      // Should be different object reference (recalculated)
      expect(result.current).not.toBe(firstResult);
      expect(result.current!.itemsById.size).toBe(11); // One more item
      expect(result.current!.rootItemIds).toContain("new-root");
      expect(result.current!.rootIdByItemId.get("new-root")).toBe("new-root");
    });

    it("should recalculate when tree config changes", () => {
      const testData = createTestData();
      const config1 = mockTreeConfig;
      const config2 = { ...mockTreeConfig, treeColumnKey: "different" };

      const { result, rerender } = renderHook(
        ({ data, config }) => useTreeStructure(data, "id", config),
        {
          initialProps: { data: testData, config: config1 },
        },
      );

      const firstResult = result.current;

      // Rerender with different config
      rerender({ data: testData, config: config2 });

      // Should be different object reference (recalculated)
      expect(result.current).not.toBe(firstResult);
    });
  });

  describe("Edge cases", () => {
    it("should handle items with null/undefined ids gracefully", () => {
      const testDataWithNulls = [
        { id: null, name: "Null ID", depth: 0, childIds: [] },
        { id: undefined, name: "Undefined ID", depth: 0, childIds: [] },
        { id: "valid", name: "Valid ID", depth: 0, childIds: [] },
      ];

      const { result } = renderHook(() =>
        useTreeStructure(testDataWithNulls, "id", mockTreeConfig),
      );

      // Should only process the valid item
      expect(result.current!.itemsById.size).toBe(1);
      expect(result.current!.itemsById.has("valid")).toBe(true);
      expect(result.current!.rootItemIds).toEqual(["valid"]);
      expect(result.current!.rootIdByItemId.size).toBe(1);
      expect(result.current!.rootIdByItemId.get("valid")).toBe("valid");
    });

    it("should handle items with empty or null childIds arrays", () => {
      const testDataWithNullChildren = [
        { id: "parent1", name: "Parent 1", depth: 0, childIds: null as any },
        {
          id: "parent2",
          name: "Parent 2",
          depth: 0,
          childIds: undefined as any,
        },
        { id: "parent3", name: "Parent 3", depth: 0, childIds: [] },
      ];

      const { result } = renderHook(() =>
        useTreeStructure(testDataWithNullChildren, "id", mockTreeConfig),
      );

      expect(result.current!.hasChildren("parent1")).toBe(false);
      expect(result.current!.hasChildren("parent2")).toBe(false);
      expect(result.current!.hasChildren("parent3")).toBe(false);
      expect(result.current!.childrenByParentId.get("parent3")).toBeUndefined();

      // All should map to themselves as they are root items
      expect(result.current!.rootIdByItemId.get("parent1")).toBe("parent1");
      expect(result.current!.rootIdByItemId.get("parent2")).toBe("parent2");
      expect(result.current!.rootIdByItemId.get("parent3")).toBe("parent3");
    });

    it("should handle complex tree structures with rootIdByItemId mapping", () => {
      const complexData = [
        { id: "root1", name: "Root 1", depth: 0, childIds: ["child1"] },
        { id: "root2", name: "Root 2", depth: 0, childIds: ["child2"] },
        { id: "child1", name: "Child 1", depth: 1, childIds: ["grandchild1"] },
        { id: "child2", name: "Child 2", depth: 1, childIds: ["grandchild2"] },
        { id: "grandchild1", name: "Grandchild 1", depth: 2, childIds: [] },
        { id: "grandchild2", name: "Grandchild 2", depth: 2, childIds: [] },
      ];

      const { result } = renderHook(() =>
        useTreeStructure(complexData, "id", mockTreeConfig),
      );

      // Verify all items map to correct roots
      expect(result.current!.rootIdByItemId.get("root1")).toBe("root1");
      expect(result.current!.rootIdByItemId.get("child1")).toBe("root1");
      expect(result.current!.rootIdByItemId.get("grandchild1")).toBe("root1");

      expect(result.current!.rootIdByItemId.get("root2")).toBe("root2");
      expect(result.current!.rootIdByItemId.get("child2")).toBe("root2");
      expect(result.current!.rootIdByItemId.get("grandchild2")).toBe("root2");
    });
  });

  describe("Circular reference detection", () => {
    it("should throw error for circular references", () => {
      const circularData = [
        { id: "parent", name: "Parent", depth: 0, childIds: ["child"] },
        { id: "child", name: "Child", depth: 1, childIds: ["parent"] }, // Circular!
      ];

      expect(() => {
        renderHook(() => useTreeStructure(circularData, "id", mockTreeConfig));
      }).toThrow(/Circular reference detected in tree structure/);
    });

    it("should provide cycle information in error message", () => {
      const circularData = [
        { id: "root", name: "Root", depth: 0, childIds: ["a"] },
        { id: "a", name: "A", depth: 1, childIds: ["b"] },
        { id: "b", name: "B", depth: 2, childIds: ["a"] }, // Creates cycle: a -> b -> a
      ];

      expect(() => {
        renderHook(() => useTreeStructure(circularData, "id", mockTreeConfig));
      }).toThrow(/Cycle involves items.*a.*b.*a/);
    });
  });
});
