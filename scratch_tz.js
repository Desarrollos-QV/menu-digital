const testDate = () => {
    const mtyDateStr = new Date().toLocaleString("en-US", { timeZone: "America/Monterrey", year: 'numeric', month: 'numeric', day: 'numeric' });
    const [month, day, year] = mtyDateStr.split('/');
    const mtyMidnightISO = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000-06:00`;
    const startOfDay = new Date(mtyMidnightISO);
    console.log("mtyDateStr:", mtyDateStr);
    console.log("mtyMidnightISO:", mtyMidnightISO);
    console.log("startOfDay:", startOfDay.toISOString());

    // Compare with the buggy approach
    const buggyStart = new Date();
    buggyStart.setHours(0,0,0,0);
    console.log("buggyStart:", buggyStart.toISOString());
};
testDate();
