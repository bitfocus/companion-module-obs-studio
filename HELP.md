## PlanningCenter-ServicesLive

This module will allow you to advance your Planning Center Online Service Plans.

### Configuration
* You will need to set up a Personal Access Token in your PCO account.
* <https://api.planningcenteronline.com/oauth/applications>
* The PCO account that makes the token will be the account that controls the plans.
* Supply the Application ID and Secret Key to Companion in the module instance settings.
* You can supply a folder ID to filter the list of services to that specific folder.
* You can also supply a service type ID to only return plans for that service type.
* You can choose how many plans per service type to return and allow as options for control.

### To use the module
Add an action to a button and choose the plan you wish to control.

**Available actions:**
* Go to Next Item
* Go to Previous Item
* Take Control (don't allow others to control LIVE)
* Release Control (release your account or others from controlling LIVE)