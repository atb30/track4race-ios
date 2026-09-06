import Navigation from './pages/Navigation';
import Routes from './pages/Routes';
import Management from './pages/Management';
import UploadGpxPage from './pages/UploadGpxPage';
import UserManagement from './pages/UserManagement';
import RunnerManagement from './pages/RunnerManagement';
import CompanionTracking from './pages/CompanionTracking';
import GpsDeviceManagement from './pages/GpsDeviceManagement';
import RoutePoiManagement from './pages/RoutePoiManagement';
import AppSettings from './pages/AppSettings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Navigation": Navigation,
    "Routes": Routes,
    "Management": Management,
    "UploadGpxPage": UploadGpxPage,
    "UserManagement": UserManagement,
    "RunnerManagement": RunnerManagement,
    "CompanionTracking": CompanionTracking,
    "GpsDeviceManagement": GpsDeviceManagement,
    "RoutePoiManagement": RoutePoiManagement,
    "AppSettings": AppSettings,
}

export const pagesConfig = {
    mainPage: "Navigation",
    Pages: PAGES,
    Layout: __Layout,
};