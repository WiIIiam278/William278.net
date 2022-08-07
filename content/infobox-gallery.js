const DEFAULT_ELEMENT = 0;
let currentElement = DEFAULT_ELEMENT;
let items;

window.onload = () => {
    const gallery = document.getElementById('infobox-gallery');
    items = gallery.getElementsByClassName('gallery-item');
    updateGallery(gallery, currentElement);

    document.getElementById('infobox-gallery-prev').onclick = () => {
        currentElement--;
        if (currentElement < 0) {
            currentElement = items.length - 1;
        }
        updateGallery(gallery, currentElement);
    };

    document.getElementById('infobox-gallery-next').onclick = () => {
        currentElement++;
        if (currentElement >= items.length) {
            currentElement = 0;
        }
        updateGallery(gallery, currentElement);
    };
};

const updateGallery = (gallery, currentElement) => {
    for (let i = 0; i < items.length; i++) {
        items[i].classList.add('inactive');
    }
    items[currentElement].classList.remove('inactive');
}