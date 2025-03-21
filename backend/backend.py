from flask import Flask

chrome = Flask(__name__)

@chrome.route('/')
def hello_world():
    return 'Hello World!'

if __name__ == '__main__':
    chrome.run(debug=True)


