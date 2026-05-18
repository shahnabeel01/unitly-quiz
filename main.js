// Show/Hide All Sections
// Show
function showSection(id) {
    document.querySelectorAll("section").forEach(section => {
        section.classList.add("hidden");
        document.getElementById("footer").classList.add("hidden");
        document.getElementById("navBar").classList.add("hidden");
    })

    document.getElementById(id).classList.remove("hidden");
}

// Hide
function hideSection(id) {
    document.querySelectorAll("section").forEach(section => {
        section.classList.remove("hidden");
        document.getElementById("footer").classList.remove("hidden");
        document.getElementById("navBar").classList.remove("hidden");
    })

    document.getElementById(id).classList.add("hidden");
}

// Show Unit-Wise Practice Section
// Buttons
unitsBtn = document.querySelector("#unitBtn");
unitsBtn.addEventListener("click", (e) => {
    showSection("unitWiseSection");
    document.title = "Unitly - Unit Wise Practice"
})
// backButton
unitsBackBtn = document.querySelector("#backToHome");
unitsBackBtn.addEventListener("click", (e) => {
    hideSection("unitWiseSection");
    // document.title = "Unitly"
    window.location.reload();
})


// Show Test Interface
// SectionBTn
testBtn = document.querySelector("#testBtn");
testBtn.addEventListener("click", (e) => {
    showSection("testSection");
    document.title = "Unitly - Questions Test"
})

// BackBtn
testBackBtn = document.querySelector("#itHomeBtn");

testBackBtn.addEventListener("click", (e) => {
    hideSection("testSection");
    window.location.reload();
})
