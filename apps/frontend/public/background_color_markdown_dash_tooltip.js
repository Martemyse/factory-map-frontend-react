// window.setInterval(function() {
//     let tooltip = document.querySelector('.dash-table-tooltip');
//     if (tooltip) {
//         let table = tooltip.querySelector('table');
//         let cells = Array.from(table.querySelectorAll('td'));

//         cells.forEach(function(td) {
//             let span = td.querySelector('span');
//             if (span) {
//                 let innerText = span.innerHTML;
//                 if (innerText.includes('🔴')) {
//                     td.style.backgroundColor = '#FFCCCC';
//                 } else if (innerText.includes('🟠')) {
//                     td.style.backgroundColor = '#FFE5CC';
//                 } else if (innerText.includes('🟡')) {
//                     td.style.backgroundColor = '#FFFFCC';
//                 } else if (innerText.includes('🟢')) {
//                     td.style.backgroundColor = '#CCFFCC';
//                 }
//             }
//         });
//     }
// }, 250);
