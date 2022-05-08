window.onload = () => {
    let timestamps = document.getElementsByClassName("message-timestamp");
    for (let i = 0; i < timestamps.length; i++) {
        let timestampInt = parseInt(timestamps[i].innerHTML);
        let timestamp = new Date(timestampInt);
        let timestampText;
        if (timestamp > (new Date(timestampInt).getDate() - 1)) {
            timestampText = "Today";
        } else if (timestamp > (new Date(timestampInt).getDate() - 2)) {
            timestampText = "Yesterday";
        } else {
            timestampText = timestamp.getDay() + " " + timestamp.getMonth() + " " + timestamp.getFullYear();
        }
        let hours = timestamp.getHours().toString();
        if (hours.length === 1) {
            hours = "0" + hours;
        }
        let minutes = timestamp.getMinutes().toString();
        if (minutes.length === 1) {
            minutes = "0" + minutes;
        }
        timestampText += " at " + hours + ":" + minutes;
        timestamps[i].innerHTML = timestampText;
    }

    // Let people view images nicely
    let images = document.getElementsByClassName("message-attachment");
    for (let i = 0; i < images.length; i++) {
        const viewer = new Viewer(images[i], {
            inline: false,
            navbar: false,
            title: false,
            toolbar: false,
            fullscreen: false,
            loop: false,
            movable: false,
            rotatable: false,
            scalable: false,
            zoomable: false,
            zoomOnWheel: false,
            zoomOnTouch: false,
            slideOnTouch: false,
            toggleOnDblclick: false,
            tooltip: false,
            transition: false,
        });

        images[i].addEventListener("click", function () {
            viewer.show(true);
        });
    }
};