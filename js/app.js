var StrapKit = require('strapkit');

var app_id = "";
var key = "";
var radius = 1000;

var parseFeed = function(data, quantity) {
    var items = [];

    var responses = data.results;

    for (var i = 0; i < quantity; i++) {

        var response = responses[i];

        // Always upper case the description string
        var title = response.name;
        title = title.charAt(0).toUpperCase() + title.substring(1);

        var type = response.types[0]; // Get the first type in the array

        // Add to menu items array
        items.push({
            title: title,
            subtitle: type,
            data: response
        });

    }

    // Finally return whole array
    return items;
};


function getLocation(cb) {

    if (navigator && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            console.log("Got Geolocation!");

            var latitude = position.coords.latitude;
            var longitude = position.coords.longitude;

            cb([latitude, longitude]);

        }, function() {
            console.log("Failed to get Geolocation!");
        }, {
            maximumAge: 60000,
            timeout: 5000,
            enableHighAccuracy: true
        });
    }

}

StrapKit.Metrics.Init(app_id);

getLocation(function(position) {

    var location = position[0] + ',' + position[1];

    // Make request using Google Places API
    StrapKit.HttpClient({
            url: 'https://maps.googleapis.com/maps/api/place/search/json?location=' + location + '&radius=' + radius + '&sensor=true&key=' + key,
            type: 'json'
        },
        function(data) {

            console.log("Data response was returned from Places API request!");

            var menuItems = parseFeed(data, 6);

            StrapKit.Metrics.logEvent("/httpClient/success", menuItems);

            var resultsPage = StrapKit.UI.Page();

            // Construct Menu to show to user
            var resultsMenu = StrapKit.UI.ListView({
                items: menuItems
            });

            // Add an action for SELECT
            resultsMenu.setOnItemClick(function(e) {
                var detailPage = StrapKit.UI.Page();

                var location = e.item.data;

                var detailPage = StrapKit.UI.Page();
                // Create the Card for detailed view
                var detailCard = StrapKit.UI.Card({
                    subtitle: e.item.title,
                    body: ""
                });

                detailPage.addView(detailCard);
                detailPage.show();

                StrapKit.Metrics.logEvent("show/detailPage", e.item.data);
            });

            // Show the Menu, hide the splash
            resultsPage.addView(resultsMenu);
            resultsPage.show();

            StrapKit.Metrics.logEvent("show/resultsPage");
        },
        function(error) {
            console.log(error);
        }
    );
});