import { useEffect } from "react";
import { FXOrder } from "./utils";

export function useseUpdatingOrders(
  setOrders: React.Dispatch<React.SetStateAction<FXOrder[]>>,
  createInterval: number,
  fillInterval: number
) {
  useEffect(() => {
    let nextId = 10000;

    const interval = setInterval(() => {
      const currencyPair = ["USD/EUR", "GBP/USD", "JPY/USD", "AUD/CAD"][
        Math.floor(Math.random() * 4)
      ];
      const side = Math.random() > 0.5 ? "BUY" : "SELL";
      const orderQuantity = Math.floor(Math.random() * 1000000) + 100000;
      const limitPrice = Number((Math.random() * 1.5 + 0.5).toFixed(4));
      const trader = [
        "John Smith",
        "Jane Wilson",
        "Alex Johnson",
        "Sarah Davis",
      ][Math.floor(Math.random() * 4)];
      const venue = ["JPM", "CITI", "BARC", "GS", "MS"][
        Math.floor(Math.random() * 5)
      ];
      const account = ["Main", "Hedge", "Client-A", "Client-B"][
        Math.floor(Math.random() * 4)
      ];
      const strategy = ["Momentum", "Mean Reversion", "Carry", "Volatility"][
        Math.floor(Math.random() * 4)
      ];
      const createdTime = new Date();

      const hasChildren = Math.random() > 0.5;
      const parentId = `order-${nextId++}`;
      const newOrders: FXOrder[] = [];

      if (hasChildren) {
        const child1Id = `${parentId}-child-0`;
        const child2Id = `${parentId}-child-1`;

        const parentOrder: FXOrder = {
          id: parentId,
          depth: 0,
          parentId: null,
          childIds: [child1Id, child2Id],
          currencyPair,
          side,
          orderQuantity,
          limitPrice,
          filledPrice: null,
          filledQuantity: 0,
          status: "NEW",
          createdTimestamp: createdTime,
          updatedTimestamp: createdTime,
          trader,
          venue,
          account,
          strategy,
          notes: "Order with 2 children",
        };

        newOrders.push(parentOrder);

        const childQuantity = Math.floor(orderQuantity / 2);
        const child1: FXOrder = {
          ...parentOrder,
          id: child1Id,
          depth: 1,
          parentId,
          childIds: [],
          orderQuantity: childQuantity,
          limitPrice: limitPrice + 0.01,
          createdTimestamp: new Date(createdTime.getTime() + 1000),
          updatedTimestamp: new Date(createdTime.getTime() + 1000),
          notes: `Child 1 for ${parentId}`,
        };
        const child2: FXOrder = {
          ...child1,
          id: child2Id,
          limitPrice: limitPrice - 0.01,
          createdTimestamp: new Date(createdTime.getTime() + 2000),
          updatedTimestamp: new Date(createdTime.getTime() + 2000),
          notes: `Child 2 for ${parentId}`,
        };

        newOrders.push(child1, child2);
      } else {
        const simpleOrder: FXOrder = {
          id: parentId,
          depth: 0,
          parentId: null,
          childIds: [],
          currencyPair,
          side,
          orderQuantity,
          limitPrice,
          filledPrice: null,
          filledQuantity: 0,
          status: "NEW",
          createdTimestamp: createdTime,
          updatedTimestamp: createdTime,
          trader,
          venue,
          account,
          strategy,
          notes: "Order without children",
        };

        newOrders.push(simpleOrder);
      }

      setOrders((prev) => [...prev, ...newOrders]);

      setTimeout(() => {
        setOrders((prev) =>
          prev.map((order) => {
            if (newOrders.some((newOrder) => newOrder.id === order.id)) {
              return {
                ...order,
                status: "FILLED",
                filledQuantity: order.orderQuantity,
                filledPrice:
                  order.limitPrice + (Math.random() > 0.5 ? 0.0025 : -0.0025),
                updatedTimestamp: new Date(),
              };
            }
            return order;
          })
        );
      }, fillInterval);
    }, createInterval);

    return () => clearInterval(interval);
  }, [setOrders]);
}
