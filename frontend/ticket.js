window.onload = () => {
    let timestamps = document.getElementsByClassName("message-timestamp");
    for (let i = 0; i < timestamps.length; i++) {
        timestamps[i].innerHTML = getTimestampText(parseInt(timestamps[i].innerText));
    }

    let ticketMeta = document.getElementsByTagName("ticket-metadata");
    for (let i = 0; i < ticketMeta.length; i++) {
        let data = ticketMeta[i].innerHTML.split("<div")[0];
        ticketMeta[i].innerHTML = ticketMeta[i].innerHTML.replace(data, "");
        let metaDataObject = JSON.parse(data);
        let formattedMeta = "<p><b>Resource: </b>" + metaDataObject.resource + "<br/>"
            + "<b>Topic: </b>" + metaDataObject.topic + "<br/>"
            + "<b>Opened: </b>" + getTimestampText(parseInt(metaDataObject.opened_timestamp)) + "<br/>"
            + "<b>Closed: </b>" + getTimestampText(parseInt(metaDataObject.closed_timestamp)) + "<br/>"
            + "<h3>Participants</h3>";

        for (let j = 0; j < metaDataObject.participants.length; j++) {
            let participant = metaDataObject.participants[j];
            formattedMeta += "<div class='message-sender'><img style='max-height: 35px' src='" + participant.avatar + "' alt='Profile picture'/>";
            formattedMeta += "<div class='message-sender-name' style='margin-top: 0.35em'>" + participant.name + "<span class='message-sender-numbers'>" + participant.numbers + "</span></div>";
            formattedMeta += "</div> <br/>";
        }

        document.getElementById("transcript-metadata").innerHTML = formattedMeta;
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

function getTimestampText(timestampInt) {
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
    return timestampText;
}