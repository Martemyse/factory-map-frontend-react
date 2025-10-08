function formatDateSLO(params) {
    if (!params.value) return ''; // Handle null or undefined values
    var date = new Date(params.value);
    var day = date.getDate().toString().padStart(2, '0');
    var month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are zero-indexed
    var year = date.getFullYear();
    var hours = date.getHours().toString().padStart(2, '0');
    var minutes = date.getMinutes().toString().padStart(2, '0');
    var seconds = date.getSeconds().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}