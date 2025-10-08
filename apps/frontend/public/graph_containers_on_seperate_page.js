// document.addEventListener("DOMContentLoaded", function() {
//     let originalHTML = null;
//     const mediaQueryList = window.matchMedia('print');
  
//     mediaQueryList.addListener(function(mql) {
//       // 1) Check the container
//       const printContainer = document.getElementById("datatable_realizacija_print_container");
//       if (!printContainer) {
//         console.warn("No element with ID 'datatable_realizacija_print_container' found.");
//         return;
//       }
  
//       if (mql.matches) {
//         // 2) Print mode activated
//         console.log("Print mode activated.");
//         // Save the container’s current HTML so we can restore it later
//         originalHTML = printContainer.innerHTML;
  
//         // 3) Find the table and graph nodes
//         const tableNodes = Array.from(
//           printContainer.querySelectorAll(".table-container-oee, .dash-table-container")
//         );
//         const graphNodes = Array.from(
//           printContainer.querySelectorAll(".graph-container-oee")
//         );
  
//         console.log("Found table nodes:", tableNodes.length);
//         console.log("Found graph nodes:", graphNodes.length);
  
//         // 4) Clear out the container
//         printContainer.innerHTML = "";
  
//         // 5) Create two wrappers
//         const tablesWrapper = document.createElement("div");
//         tablesWrapper.style.breakInside = "avoid";  // Attempt to keep all tables together
  
//         const graphsWrapper = document.createElement("div");
//         graphsWrapper.style.breakBefore = "always"; // Force a new page for graphs
//         graphsWrapper.style.breakInside = "avoid";
  
//         // 6) Move table nodes into tablesWrapper
//         tableNodes.forEach((node, idx) => {
//           node.style.breakInside = "avoid";
//           tablesWrapper.appendChild(node);
//           console.log("Appending table node:", idx);
//         });
  
//         // 7) Move graph nodes into graphsWrapper
//         graphNodes.forEach((node, idx) => {
//           node.style.breakInside = "avoid";
//           graphsWrapper.appendChild(node);
//           console.log("Appending graph node:", idx);
//         });
  
//         // 8) Reinsert these wrappers into the container
//         printContainer.appendChild(tablesWrapper);
//         printContainer.appendChild(graphsWrapper);
  
//         console.log("Tables placed first, graphs placed second for print layout.");
//       } else {
//         // 9) Print mode deactivated
//         console.log("Print mode deactivated. Restoring original layout.");
//         // Restore original HTML
//         if (originalHTML !== null) {
//           printContainer.innerHTML = originalHTML;
//           originalHTML = null;
//         }
//       }
//     });
//   });
  