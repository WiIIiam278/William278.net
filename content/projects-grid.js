const DEFAULT_GRID_LIMIT = 6;
let gridLimit = DEFAULT_GRID_LIMIT;

window.onload = () => {
    // Get all grid items
    let totalGridItems = document.getElementsByClassName('project-box').length;
    setGridItems();

    // When expand-button-link is clicked, change grid limit to 6
    document.getElementById('expand-button-link').onclick = () => {
        let icon = document.getElementById('expand-button-icon');
        let text = document.getElementById('expand-button-text');
        if (gridLimit === DEFAULT_GRID_LIMIT) {
            gridLimit = totalGridItems;
            icon.className = 'fas fa-chevron-up';
            text.innerText = 'Collapse';
        } else {
            gridLimit = DEFAULT_GRID_LIMIT;
            icon.className = 'fas fa-chevron-down';
            text.innerText = 'Expand';
        }
        setGridItems();
    }
}

const setGridItems = () => {
    // Set contents of project-box-grid to gridItems
    let projectBoxes = document.getElementsByClassName('project-box');
    for (let i = 0; i < projectBoxes.length; i++) {
        if (i > gridLimit - 1) {
            projectBoxes[i].classList.add('inactive');
        } else {
            projectBoxes[i].classList.remove('inactive');
        }
    }
}