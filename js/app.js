var StrapKit = require('strapkit');

var app_id = "";
var key = "";
var radius = 1000;
var perferences;
var places_traveled = [];

var parseFeed = function(data, quantity) {
    var items = [];

    var responses = data.results;

    for (var i = 0; i < quantity; i++) {

        var response = responses[i];

        console.log(JSON.stringify(response));

        try {
            // Always upper case the description string
            var title = formatString(response.name);


            var type = response.types[0]; // Get the first type in the array

            if (((type == "restaurant") || (type == "meal_takeaway")) && (!isAppropriate(new Date().getTime()))) {
                continue;
            }

            if ((type == "neighborhood") || (type == "lodging")) {
                continue;
            }

            // Add to menu items array
            items.push({
                title: title,
                subtitle: formatString(type),
                data: response
            });
        } catch (error) {
            console.error(error);
        }

    }

    // Finally return whole array
    return items;
};


function formatString(unformatted) {
    // Capitalizes the first letting of the unformatted String
    unformatted = unformatted.charAt(0).toUpperCase() + unformatted.substring(1);

    // Removes underscores and returns the result
    return unformatted.replace(/_/g, ' ');
}

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

    console.log("Getting places near location: " + location);

    setupApplication(function() {


        // Make request using Google Places API
        StrapKit.HttpClient({
                url: 'https://maps.googleapis.com/maps/api/place/search/json?location=' + location + '&radius=' + radius + '&sensor=true&key=' + key,
                type: 'json'
            },
            function(places_data) {
                if (checkRenderError(places_data)) {
                    return;
                }

                console.log("Data response was returned from Places API request!");

                console.log(JSON.stringify(places_data));

                var menuItems = parseFeed(places_data, 25);

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
                            if (checkRenderError(place_data)) {
                                return;
                            }

                            console.log("Got detailed data about the place.");

                            var detailPage = StrapKit.UI.Page();

                            var content = "";

                            if (place_data.result.rating) {
                                content = "Average rating: " + place_data.result.rating;
                            }

                            content += "\n";
                            content += "Type: " + formatString(place.types[0]); // Referes to unspecific type in types array

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
});

function checkRenderError(jsonResponse) {
    if (jsonResponse.hasOwnProperty('error_message')) {

        var errorPage = StrapKit.UI.Page();
        var errorCard = StrapKit.UI.Card({
            title: "Something went wrong!",
            body: jsonResponse.error_message
        });

        errorPage.addView(errorCard);
        errorPage.show();

        console.error("Application crashed beause " + jsonResponse.error_message);
        return true;
    }

    return false;
}

function setupApplication(callback) {
    var key = 2;

    if (keyContainsData(key)) {
        perferences = getConfig(key);
        callback();
    } else {
        perferences = createConfig(key, function() {
            callback();
        });
    }
}

function keyContainsData(key) {
    var content = getConfig(key);

    // Return true if the content of data stored in the key is greater than 0
    return content != null;
}

function getConfig(key) {
    // Prints what content is stored in a given key
    console.log(localStorage.getItem(key) + " is stored in key " + key);
    return localStorage.getItem(key);
}

function createConfig(key, callback) {
    console.log("Creating the configuration file!");


    var likes = []; // Included items with higher pecedence
    var dislikes = []; // Included items with lower pecedence
    var exclude = propogateExclusionList(); // Items omited from all results

    var setupSplashPage = StrapKit.UI.Page();
    var setupSplashCard = StrapKit.UI.Card({
        title: "Do you?",
        body: "Let's get to know each other. Answer the following so we can best determine your perferences."
    });

    setupSplashCard.setOnClick(function(e) {
        createSetupPage("Eat out often?", function(state) {
            console.log("The answer to the previous question was " + state);

            if (state) {
                likes.push("restaurant");
                likes.push("food");
                likes.push("meal_takeaway");
                likes.push("meal_delivery");
            }

            createSetupPage("Enjoy fashion?", function(state) {
                console.log("The answer to the previous question was " + state);

                if (state) {
                    likes.push("beauty_salon");
                    likes.push("clothing_store");
                    likes.push("hair_care");
                    likes.push("jewelry_store");
                    likes.push("spa");
                } else {
                    dislikes.push("beauty_salon");
                    dislikes.push("clothing_store");
                    dislikes.push("hair_care");
                    dislikes.push("jewelry_store");
                    dislikes.push("spa");
                }

                createSetupPage("Like parks?", function(state) {
                    console.log("The answer to the previous question was " + state);

                    if (state) {
                        likes.push("park");
                    } else {
                        dislikes.push("park");
                    }

                    createSetupPage("Enjoy learning?", function(state) {
                        console.log("The answer to the previous question was " + state);

                        if (state) {
                            likes.push("library");
                            likes.push("university");
                            likes.push("book_store");
                        } else {
                            dislikes.push("library");
                            dislikes.push("university");
                        }

                        createSetupPage("Drink coffee?", function(state) {
                            console.log("The answer to the previous question was " + state);

                            if (state) {
                                likes.push("cafe");
                            }

                            createSetupPage("Familiar to area?", function(state) {
                                console.log("The answer to the previous question was " + state);

                                if (state) {
                                    dislikes.push("taxi_stand");
                                    dislikes.push("train_station");
                                    dislikes.push("subway_station");
                                }

                                // Creates the ending page
                                var setupEndPage = StrapKit.UI.Page();
                                var setupEndCard = StrapKit.UI.Card({
                                    title: "Thanks!",
                                    body: "Press and hold the back button. We won't ask you to go through the setup again."
                                });

                                setupEndPage.addView(setupEndCard);
                                setupEndPage.show();
                                
                                // Show the ending page for 5 seconds before going to the main view
                                setTimeout(function(){ callback(); }, 5000);
                            });
                        });
                    });
                });
            });
        });
    });

    setupSplashPage.addView(setupSplashCard);
    setupSplashPage.show();

}

function createSetupPage(title, callback) {
    var setupPage = StrapKit.UI.Page();

    var items = [];

    items.push({
        title: title,
    });

    items.push({
        title: "Yes"
    });
    items.push({
        title: "No"
    });

    /// Construct Menu to show to user
    var setupMenu = StrapKit.UI.ListView({
        items: items
    });

    setupPage.addView(setupMenu);
    setupPage.show();

    setupMenu.setOnItemClick(function(e) {

        // if the length of the title is not greater than 4, it must be either "Yes" or "No"
        if (!(e.item.title.length > 4)) {
            var state = (e.item.title == "Yes") ? true : false;
            callback(state);
        }

    });

}

propogateExclusionList = function() {
    var list = [];

    list.push("synagogue");
    list.push("locksmith");
    list.push("rv_park");
    list.push("roofing_contractor");
    list.push("real_estate_agency");
    list.push("post_office");
    list.push("airport");
    list.push("atm");
    list.push("bank");
    list.push("car_dealer");
    list.push("car_rental");
    list.push("car_wash");
    list.push("cemetery");
    list.push("church");
    list.push("city_hall");
    list.push("dentist");
    list.push("doctor");
    list.push("fire_station");
    list.push("funeral_home");
    list.push("furniture_store");
    list.push("hardware_store");
    list.push("hospital");
    list.push("insurance_agency");
    list.push("lawyer");
    list.push("local_government_office");
    list.push("mosque");
    list.push("moving-company");
    list.push("painter");
    list.push("place_of_worship");
    list.push("plumber");
    list.push("storage");
    list.push("physiotherapist");
    list.push("travel_agency");
    list.push("police");
    list.push("laundry");

    return list;
}


function atLocation(location) {
    var close_radius = 50;

    StrapKit.HttpClient({
            url: 'https://maps.googleapis.com/maps/api/place/search/json?location=' + location + '&radius=' + close_radius + '&sensor=true&key=' + key,
            type: 'json'
        },
        function(places_data) {
            place = places_data.result[0];
            places_traveled.push[place];

        },
        function(error) {
            console.log(error);
        }
    );
}