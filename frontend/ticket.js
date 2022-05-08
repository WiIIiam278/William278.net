window.onload = () => {
    let timestamps = document.getElementsByClassName("message-timestamp");
    for (let i = 0; i < timestamps.length; i++) {
        let timestampInt = parseInt(timestamps[i].innerHTML);
        let timestamp = new Date(timestampInt);

        let todayStamp = new Date();
        todayStamp.setHours(0, 0, 0, 0);

        const yesterdayStamp = new Date(todayStamp);
        yesterdayStamp.setDate(yesterdayStamp.getDate() - 1);

        let timestampText = timestamp.toLocaleString('default', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
        if (timestamp >= yesterdayStamp) {
            timestampText = "Yesterday";
        }
        if (timestamp >= todayStamp) {
            timestampText = "Today";
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