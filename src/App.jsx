import React from "react";
import OrderList from "./components/OrderList";
import { AppProvider } from "@shopify/polaris";
import "@shopify/polaris/build/esm/styles.css";

function App() {
  return (
    <AppProvider i18n={{}}>
      <OrderList />
    </AppProvider>
  );
}

export default App;
