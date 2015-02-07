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

        if ((type == "restaurant") && (!isAppropriate(new Date().getTime()))) {
            continue;
        }

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

function isAppropriate(time) {

    var time = (((time) / 1000) / 60) % 1440;
    var breakfastStart = 300;
    var breakfastEnd = 420;

    var lunchStart = 600;
    var lunchEnd = 720;

    var dinnerStart = 960;
    var dinnerEnd = 1080;

    return ((time >= breakfastStart && time <= breakfastEnd) || (time >= lunchStart && time <= lunchEnd) || (time >= dinnerStart && time <= dinnerEnd));
}


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
        function(places_data) {

            console.log("Data response was returned from Places API request!");

            var menuItems = parseFeed(places_data, 4);

            StrapKit.Metrics.logEvent("/httpClient/success", menuItems);

            var resultsPage = StrapKit.UI.Page();

            // Construct Menu to show to user
            var resultsMenu = StrapKit.UI.ListView({
                items: menuItems
            });

            // Add an action for SELECT
            resultsMenu.setOnItemClick(function(e) {

                var place = e.item.data;

                // Query the Places API to get details about the specific place
                StrapKit.HttpClient({
                        url: 'https://maps.googleapis.com/maps/api/place/details/json?placeid=' + place.place_id + '&key=' + key,
                        type: 'json'
                    },
                    function(place_data) {

                        console.log("Got detailed data about the place.");

                        var detailPage = StrapKit.UI.Page();

                        if (place_data.result.rating) {
                            content = "Average rating: " + place_data.result.rating;
                        }

                        // Create the Card for detailed view
                        var detailCard = StrapKit.UI.Card({
                            title: e.item.title,
                            body: content
                        });

                        detailPage.addView(detailCard);
                        detailPage.show();

                        StrapKit.Metrics.logEvent("show/detailPage", e.item.data);

                    },
                    function(error) {
                        console.log(error);
                    }
                );

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