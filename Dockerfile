#Get latest node docker image
FROM node:latest

#Create a working directory
RUN mkdir -p /opt/apps/nsdb

#Use new directory as working directory -- set's the working directory for any following COPY, RUN, CMD commands
WORKDIR /opt/apps/nsdb

#Grab package.json for npm install
COPY package.json /opt/apps/nsdb

#Clean the cache
RUN npm cache clean --force

#Install dependencies from package.json
RUN npm install

#Copy files into working directory within container
COPY . /opt/apps/nsdb

#Expose port 80 to external
EXPOSE 8099

RUN sed 's/localhost/mongo/' public/default-config.json

#Start the application
CMD ["npm", "start"]


