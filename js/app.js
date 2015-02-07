var StrapKit = require('strapkit');

var app_id = "";
var key = "";
var radius = 1000;
var location = "37.226789,-80.422676";

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

StrapKit.Metrics.Init(app_id);

// Make request using Google Places API
StrapKit.HttpClient({
        url: 'https://maps.googleapis.com/maps/api/place/search/json?location=' + location + '&radius=' + radius + '&sensor=true&key=' + key,
        type: 'json'
    },
    function(data) {

        var menuItems = parseFeed(data, 4);

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
