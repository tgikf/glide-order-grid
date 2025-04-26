import OrderGrid from "./OrderGrid";
import "./styles.css";

export default function App() {
  return (
    <div
      style={{
        backgroundColor: "#0F233E",
        minHeight: "100vh",
        minWidth: "100vw",
        color: "#FFFFFF",
      }}
    >
      <OrderGrid />
    </div>
  );
}
