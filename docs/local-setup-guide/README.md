# EVAT Local Setup Guide

## How does it all fit together?

### Frontend ⇄ Backend ⇄ MongoDB

The arrows represent the direction of communication. The frontend sends requests to the backend API, which then queries MongoDB or runs data science logic before returning the response back to the frontend.

EVAT’s main architecture is frontend → backend → MongoDB. The website, app, and chatbot should call backend APIs rather than access the database directly. Data science features should be integrated through backend endpoints so the frontend can consume predictions, analytics, or recommendations cleanly.

Before using this guide, it is recommended that you to go to the [Chameleon EVAT GitHub repo](https://github.com/Chameleon-company/EVAT) and read the [installation instructions there](https://github.com/Chameleon-company/EVAT#-installation--running-locally). This guide is to be treated as an addendum to those instructions. 

In this guide, we will first set up the database, then the backend and front end, and then we'll try running it all together. Let’s go! 

---
## Setting up your database

We use **MongoDB** for this project. There are two ways you can have the database set up:

1. A clone of the database on your own MongoDB account
2. Obtaining access to a database copy that is shared with other students.

Your own clone is useful for testing without worrying about messing up the data, while a shared copy is useful if you're collaborating with others, especially if you're implementing or working with new features (as they'll likely involve data that doesn't exist on the older clone).

It's useful to have both methods available to you, so let's go through them now.

### 1. Making your own private clone
#### Create a new database
1. Go to [https://account.mongodb.com/account/login](https://account.mongodb.com/account/login) and log in or create a new account.
   💡Set up an account with your Deakin email address. This is to allow you to connect to a shared database.
2. Go to [https://cloud.mongodb.com/v2#preferences/organizations](https://cloud.mongodb.com/v2#preferences/organizations) and select Create New Organization 
    
    ![MongoDB Atlas organizations page](images/mongodb-atlas-organizations.png)
    
3. Give your organization a name, select **MongoDB Atlas** then click **Next**:

    ![Creating a MongoDB Atlas organization](images/mongodb-atlas-create-organization.png)
    
4. You may skip adding members and set permissions on the next page. Select **Create Organization**:

    ![MongoDB Atlas organization members and permissions](images/mongodb-atlas-organization-members.png)
    
5. Select **Create new project**, name your project and click **Next**:

    ![Creating a MongoDB Atlas project](images/mongodb-atlas-create-project.png)
    
6. Again, leave the members and permission empty here. Click **Create Project**:

    ![MongoDB Atlas project members and permissions](images/mongodb-atlas-project-members.png)
    
7. Now, we create a cluster. Click **Create**:

    ![Creating a MongoDB Atlas cluster](images/mongodb-atlas-create-cluster.png)
    
8. Select **Free**, name your cluster, and then click **Create Deployment**:

    ![Configuring a free MongoDB Atlas cluster](images/mongodb-atlas-free-cluster-configuration.png)

9. A database user should be created. **Save the username and password** and click **Choose a connection method**:

    ![MongoDB Atlas database user credentials](images/mongodb-atlas-database-user-credentials.png)
    
10. Select Compass:

    ![Choosing a MongoDB Atlas connection method](images/mongodb-atlas-choose-connection-method.png)

11. If you don't already have Compass installed, you will be prompted to download it:

    ![MongoDB Compass connection string and download instructions](images/mongodb-atlas-compass-connection-string.png)
    
12. Before you click **Done**, **save your connection string**. It is the text that has been partially de-identified in the above screenshot.
    
13. Next we need to restore the backup database to this one that we just created. To do this, you will need to install [MongoDB tools](tools) and download a copy of the [database data](https://deakin365.sharepoint.com/sites/Chameleon2/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FChameleon2%2FShared%20Documents%2FProject%20%2D%20EV%20Adoption%20Tools%20%28EVAT%29%2FDatabase%5FData%2Ezip&parent=%2Fsites%2FChameleon2%2FShared%20Documents%2FProject%20%2D%20EV%20Adoption%20Tools%20%28EVAT%29). 

14. Unzip the backup archive somewhere on your system, open a new terminal in the directory that contains the `dump` directory of the extracted archive, and run the command `mongorestore --uri <your_connection_uri_here> dump/`
15. To verify the process was successful, open MongoDB Compass, select **New Connection** (or the '+' button), paste in your URI string and click **Save & Connect**:

    ![Creating a connection in MongoDB Compass](images/mongodb-compass-new-connection.png)
    
16. If all was successful, you will be able to navigate the database from within Compass:

    ![Browsing the EVAT database in MongoDB Compass](images/mongodb-compass-database-browser.png)
    
17. Once you've connected via Compass, you will also be able to view the data online by navigating to your project and selecting **Browse Collections**:

    ![Opening collections in MongoDB Atlas](images/mongodb-atlas-browse-collections.png)
    
### 2. Connecting to a shared database
1. This process is comparatively simple, but relies on you having created a MongoDB account with your Deakin email address, per step 1 of the previous section.
2. Ask one of the student leaders to provide you with access to the shared database.
3. They will add your Deakin email address as a user to a shared MongoDB database.
4. They will also provide you with a connection string like the one in step 12 of the previous section.

---
## Setting up the EVAT application

Now that we have our database, let's get the application running!

This section of the guide assumes familiarity with Git, that you have Git installed, and that you know how to clone a repository. If you aren't sure about any of these steps, watch a tutorial video or maybe ask for help on Teams! Knowledge of Git is necessary to make changes to the existing codebase, so it will be necessary to know how to use it this trimester.
### Cloning the repo
EVAT consists of a single GitHub repository: [https://github.com/Chameleon-company/EVAT](https://github.com/Chameleon-company/EVAT). Clone this repo to your system. The repo consists of two main parts: the front-end web app in the `/client` subdirectory, and the back-end server in the `/server` subdirectory. The server itself contains two parts: a Node API in `/server/node-api`, and several Python services used for things like charging station recommendation, price prediction and demand forecasting in `/server/python-services`.
### Backend Setup
💡Make sure to install Node.js first if you do not have it already. The LTS version gives you `node` and `npm`. You can download it from [here](https://nodejs.org/en/download).

After installing, open PowerShell (Windows) or Terminal (macOS or Linux) and type:
```jsx
node -v
npm -v
```
If Node and npm were successfully installed, you will see version numbers. 

#### Creating a .env file
Once Node and npm are installed:
1. Navigate to the `server/node-api` directory of the EVAT repository.
2. Create a new text file called `.env`.    
    ⚠️ Make sure the filename is just `.env` with no extension, not `.env.txt` or something.
3. Files starting with a `.` are hidden by default; you may need to alter the settings in your file browser to view them. Alternatively, in terminal on macOS or Linux, use the `-a` flag with `ls` to list all files including hidden ones:

    ![Listing hidden files in the terminal](images/terminal-list-hidden-files.png)

#### Populating the .env file
In the `.env` file, paste the following information:
```jsx
DOMAIN_URL=http://localhost
MONGODB_URI=
JWT_SECRET=

GOOGLE_MAPS_API_KEY=

EMAIL_USER=
EMAIL_PASS=
ADMIN_EMAIL=

PYTHON_API_URL=http://127.0.0.1:5000
RELIABILITY_API_URL=http://127.0.0.1:8003
```

Now, let's figure out how to populate each missing value!

##### MONGODB_URI
This is the connection string from the database setup above 🙂 - paste in the string (including the username and password) for either your private clone of the database or a shared database.

##### JWT_SECRET
This is private hash that you create. With Node installed, you can generate one with the following command:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

##### GOOGLE_MAPS_API_KEY
1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/) and create a new project.
2. Ensure you have a billing account and it is enabled ([https://console.cloud.google.com/billing/](https://console.cloud.google.com/billing/))
3. Click the sidebar menu and go to 'API & Services'
4. Click 'Enable APIs and services'
5. Search for and enable 'Places API (New)', 'Places API', 'Distance Matrix API', and 'Directions API'
6. At the top of the page search for 'Credentials' and click on it
7. Click 'Create Credentials' then 'API key'
8. Copy the API key into the `.env` file for `GOOGLE_MAPS_API_KEY="Key"`

##### EMAIL_USER and EMAIL_PASS
The server uses Nodemailer to send admin 2FA codes. For the development environment, it is set up to work with Gmail sending to a fixed address. `EMAIL_USER` is the account these emails are sent **from**; you'll use your Gmail account to do so.

To set up your Gmail account for Nodemailer:
1. Go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
2. On the screen that appears, name your mailer and click Create:

    ![Creating a Google app password](images/google-create-app-password.png)

3. A password will be displayed:

    ![Generated Google app password](images/google-generated-app-password.png)

4. Enter this password without spaces into the `EMAIL_PASS` field and your email address into the `EMAIL_USER` field.

##### ADMIN_EMAIL
This is the email address 2FA emails are sent **to**. It should be different to the `EMAIL_USER` address - either use your Deakin email or use something called **plus addressing** to use your Gmail again 🙂.

This involves adding a plus sign (‘+’) and any text after your email username, but before the ‘@’ symbol.

For example, if your email is username@gmail.com, you could have aliases of username+evat_user@gmail.com and username+evat_admin@gmail.com.

All aliased emails will deliver to your main inbox, but will show which ‘+’ address they were delivered to. 
### Frontend Setup

Thankfully, this one is much simpler 🙂

1. Navigate to the /client/web-app subdirectory
2. Create a new `.env` file
3. Paste the following into it:
4. Go to the EVAT-Website directory
5. Right click and select new >text document and rename to create a `.env` file and paste the following into it: `VITE_API_URL=http://localhost:8080/api`

That's it!

#### Root folder setup
There is *one* more `.env` file to set up, to be placed in the root directory of the repository. This one is also very simple.

1. Create the `.env` file. It should be in the parent directory of the repository - the same folder that has the `client` and `server` directories, among other things:

    ![Repository root containing the environment file](images/terminal-repository-root-env-file.png)

2. In this `.env` file, paste the following info:
```jsx
PORT=8080
VITE_API_URL=http://localhost:${PORT}/api
```

### Python Services Setup
The last thing we need to do is install a few things so the Python environment works properly.

Install Python by [downloading it directly](https://www.python.org/downloads/), or installing it via a package manager, e.g.:
```bash
# Linux
sudo apt install python3

# macOS with Homebrew
brew install python
```

Verify it's installed by typing `python3` into the command line. If it's installed, you'll get a command prompt:

![Running the Python interpreter in the terminal](images/terminal-python-interpreter.png)

Type `exit()` to get back out of this.

You'll also need uv, which is a Python project manager that EVAT uses to manage Python libraries. Install it by [downloading it directly](https://docs.astral.sh/uv/getting-started/installation/), or  from the command line:
```shell
# macOS with Homebrew
brew install uv

# macOS or Linux with the standalone installer
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows with WinGet
winget install --id=astral-sh.uv -e
```

Verify that it is available with `uv --version`.

## Running the app

We're finally ready! From the root directory of the repository, run:
```bash
npm run install:all
```

This will install all JavaScript and Python dependencies.

Once that's done, start the whole application with:
```bash
npm run dev
```

Alternatively, you can start individual components separately:
```bash
npm run dev:server
npm run dev:client
npm run dev:python
```

## Acknowledgements

This document is based on a prior version [hosted on Notion](https://app.notion.com/p/EVAT-Local-Setup-Guide-3226cbc7dc438012b7f7c742ad3dc70a), created by Rooi En Teong in T1 2026 and itself based on work by William Bacaimis in T3 2025.
